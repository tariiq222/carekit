import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import {
  parsePaginationParams,
  buildPaginationMeta,
} from '../../common/helpers/pagination.helper.js';
import { CreateCouponDto } from './dto/create-coupon.dto.js';
import { UpdateCouponDto } from './dto/update-coupon.dto.js';
import { ApplyCouponDto } from './dto/apply-coupon.dto.js';
import { ValidateCouponDto } from './dto/validate-coupon.dto.js';
import { CouponFilterDto } from './dto/coupon-filter.dto.js';

// Minimal coupon shape needed for validation — loaded with couponServices relation
type CouponForValidation = {
  id: string;
  expiresAt: Date | null;
  maxUses: number | null;
  usedCount: number;
  maxUsesPerUser: number | null;
  minAmount: number;
  discountType: string;
  discountValue: number;
  couponServices: Array<{ serviceId: string }>;
};

const COUPON_INCLUDE = {
  couponServices: { select: { serviceId: true } },
} as const;

@Injectable()
export class CouponsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: CouponFilterDto) {
    const { page, perPage, skip } = parsePaginationParams(
      query.page,
      query.perPage,
    );
    const now = new Date();
    const where = this.buildWhereClause(query, now);

    const [items, total] = await Promise.all([
      this.prisma.coupon.findMany({
        where,
        include: COUPON_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip,
        take: perPage,
      }),
      this.prisma.coupon.count({ where }),
    ]);

    return {
      items: items.map(this.toResponseShape),
      meta: buildPaginationMeta(total, page, perPage),
    };
  }

  async findById(id: string) {
    const coupon = await this.prisma.coupon.findUnique({
      where: { id },
      include: COUPON_INCLUDE,
    });
    if (!coupon) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Coupon not found',
        error: 'NOT_FOUND',
      });
    }
    return this.toResponseShape(coupon);
  }

  async create(dto: CreateCouponDto) {
    const code = dto.code.toUpperCase();

    const existing = await this.prisma.coupon.findUnique({ where: { code } });
    if (existing) {
      throw new ConflictException({
        statusCode: 409,
        message: 'A coupon with this code already exists',
        error: 'CONFLICT',
      });
    }

    const coupon = await this.prisma.coupon.create({
      data: {
        code,
        descriptionAr: dto.descriptionAr,
        descriptionEn: dto.descriptionEn,
        discountType: dto.discountType,
        discountValue: dto.discountValue,
        minAmount: dto.minAmount ?? 0,
        maxUses: dto.maxUses,
        maxUsesPerUser: dto.maxUsesPerUser,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        isActive: dto.isActive ?? true,
        couponServices: dto.serviceIds?.length
          ? { create: dto.serviceIds.map((serviceId) => ({ serviceId })) }
          : undefined,
      },
      include: COUPON_INCLUDE,
    });

    return this.toResponseShape(coupon);
  }

  async update(id: string, dto: UpdateCouponDto) {
    await this.findById(id);

    const data: Record<string, unknown> = {};
    if (dto.code !== undefined) data.code = dto.code.toUpperCase();
    if (dto.descriptionAr !== undefined) data.descriptionAr = dto.descriptionAr;
    if (dto.descriptionEn !== undefined) data.descriptionEn = dto.descriptionEn;
    if (dto.discountType !== undefined) data.discountType = dto.discountType;
    if (dto.discountValue !== undefined) data.discountValue = dto.discountValue;
    if (dto.minAmount !== undefined) data.minAmount = dto.minAmount;
    if (dto.maxUses !== undefined) data.maxUses = dto.maxUses;
    if (dto.maxUsesPerUser !== undefined)
      data.maxUsesPerUser = dto.maxUsesPerUser;
    if (dto.expiresAt !== undefined) data.expiresAt = new Date(dto.expiresAt);
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    // Atomically replace service restrictions when provided
    if (dto.serviceIds !== undefined) {
      await this.prisma.$transaction([
        this.prisma.couponService.deleteMany({ where: { couponId: id } }),
        ...(dto.serviceIds.length
          ? [
              this.prisma.couponService.createMany({
                data: dto.serviceIds.map((serviceId) => ({
                  couponId: id,
                  serviceId,
                })),
              }),
            ]
          : []),
      ]);
    }

    const updated = await this.prisma.coupon.update({
      where: { id },
      data,
      include: COUPON_INCLUDE,
    });

    return this.toResponseShape(updated);
  }

  async delete(id: string) {
    await this.findById(id);
    await this.prisma.coupon.delete({ where: { id } });
    return { deleted: true };
  }

  async applyCoupon(
    dto: ApplyCouponDto,
    userId: string,
  ): Promise<{ discountAmount: number; couponId: string }> {
    const coupon = await this.prisma.coupon.findFirst({
      where: { code: dto.code.toUpperCase(), isActive: true },
      include: COUPON_INCLUDE,
    });

    if (!coupon) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Coupon not found or inactive',
        error: 'COUPON_NOT_FOUND',
      });
    }

    this.validateCouponExpiry(coupon);
    this.validateCouponUsageLimit(coupon);
    await this.validatePerUserLimit(coupon, userId);
    this.validateServiceRestriction(coupon, dto.serviceId);
    this.validateMinAmount(coupon, dto.amount);

    const discountAmount = this.calculateDiscount(
      coupon.discountType,
      coupon.discountValue,
      dto.amount,
    );
    return { discountAmount, couponId: coupon.id };
  }

  async validateCode(
    dto: ValidateCouponDto,
    userId: string,
  ): Promise<{
    valid: boolean;
    discountAmount: number;
    type: 'coupon';
    couponId?: string;
  }> {
    const code = dto.code.toUpperCase();

    const coupon = await this.prisma.coupon.findFirst({
      where: { code, isActive: true },
      include: COUPON_INCLUDE,
    });

    if (!coupon) {
      return { valid: false, discountAmount: 0, type: 'coupon' };
    }

    try {
      this.validateCouponExpiry(coupon);
      this.validateCouponUsageLimit(coupon);
      await this.validatePerUserLimit(coupon, userId);
      this.validateServiceRestriction(coupon, dto.serviceId);
      this.validateMinAmount(coupon, dto.amount);
    } catch {
      return { valid: false, discountAmount: 0, type: 'coupon' };
    }
    const discountAmount = this.calculateDiscount(
      coupon.discountType,
      coupon.discountValue,
      dto.amount,
    );
    return {
      valid: true,
      discountAmount,
      type: 'coupon',
      couponId: coupon.id,
    };
  }

  async redeemCoupon(
    couponId: string,
    userId: string,
    bookingId: string,
    amount: number,
  ) {
    await this.prisma.$transaction([
      this.prisma.couponRedemption.create({
        data: { couponId, userId, bookingId, amount },
      }),
      this.prisma.coupon.update({
        where: { id: couponId },
        data: { usedCount: { increment: 1 } },
      }),
    ]);
  }

  // ═══════════════════════════════════════════════════════════════
  //  PRIVATE HELPERS
  // ═══════════════════════════════════════════════════════════════

  private toResponseShape(
    coupon: { couponServices: Array<{ serviceId: string }> } & Record<
      string,
      unknown
    >,
  ) {
    const { couponServices, ...rest } = coupon;
    return {
      ...rest,
      // Backwards-compatible shape: expose serviceIds as flat array
      serviceIds: couponServices.map((cs) => cs.serviceId),
    };
  }

  private buildWhereClause(
    query: CouponFilterDto,
    now: Date,
  ): Record<string, unknown> {
    const where: Record<string, unknown> = {};
    if (query.search)
      where.code = { contains: query.search, mode: 'insensitive' };
    if (query.status === 'active') {
      where.isActive = true;
      where.OR = [{ expiresAt: null }, { expiresAt: { gt: now } }];
    } else if (query.status === 'inactive') {
      where.isActive = false;
    } else if (query.status === 'expired') {
      where.expiresAt = { lte: now };
    }
    return where;
  }

  private validateCouponExpiry(
    coupon: Pick<CouponForValidation, 'expiresAt'>,
  ): void {
    if (coupon.expiresAt && coupon.expiresAt < new Date()) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'Coupon has expired',
        error: 'COUPON_EXPIRED',
      });
    }
  }

  private validateCouponUsageLimit(
    coupon: Pick<CouponForValidation, 'maxUses' | 'usedCount'>,
  ): void {
    if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'Coupon usage limit reached',
        error: 'COUPON_LIMIT_REACHED',
      });
    }
  }

  private async validatePerUserLimit(
    coupon: Pick<CouponForValidation, 'id' | 'maxUsesPerUser'>,
    userId: string,
  ): Promise<void> {
    if (coupon.maxUsesPerUser === null) return;
    const userRedemptions = await this.prisma.couponRedemption.count({
      where: { couponId: coupon.id, userId },
    });
    if (userRedemptions >= coupon.maxUsesPerUser) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'You have reached the maximum uses for this coupon',
        error: 'COUPON_USER_LIMIT_REACHED',
      });
    }
  }

  private validateServiceRestriction(
    coupon: Pick<CouponForValidation, 'couponServices'>,
    serviceId?: string,
  ): void {
    if (coupon.couponServices.length > 0 && serviceId) {
      if (!coupon.couponServices.some((cs) => cs.serviceId === serviceId)) {
        throw new BadRequestException({
          statusCode: 400,
          message: 'Coupon is not valid for this service',
          error: 'COUPON_SERVICE_MISMATCH',
        });
      }
    }
  }

  private validateMinAmount(
    coupon: Pick<CouponForValidation, 'minAmount'>,
    amount: number,
  ): void {
    if (amount < coupon.minAmount) {
      throw new BadRequestException({
        statusCode: 400,
        message: `Minimum amount required: ${coupon.minAmount}`,
        error: 'COUPON_MIN_AMOUNT',
      });
    }
  }

  private calculateDiscount(
    discountType: string,
    discountValue: number,
    amount: number,
  ): number {
    if (discountType === 'percentage')
      return Math.round((amount * discountValue) / 100);
    return Math.min(discountValue, amount);
  }
}
