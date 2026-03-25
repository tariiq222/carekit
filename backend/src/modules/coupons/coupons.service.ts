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
import { CouponFilterDto } from './dto/coupon-filter.dto.js';

@Injectable()
export class CouponsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: CouponFilterDto) {
    const { page, perPage, skip } = parsePaginationParams(
      query.page,
      query.limit,
    );
    const now = new Date();
    const where = this.buildWhereClause(query, now);

    const [items, total] = await Promise.all([
      this.prisma.coupon.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: perPage,
      }),
      this.prisma.coupon.count({ where }),
    ]);

    return {
      items,
      meta: buildPaginationMeta(total, page, perPage),
    };
  }

  async findById(id: string) {
    const coupon = await this.prisma.coupon.findUnique({ where: { id } });
    if (!coupon) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Coupon not found',
        error: 'NOT_FOUND',
      });
    }
    return coupon;
  }

  async create(dto: CreateCouponDto) {
    const code = dto.code.toUpperCase();

    const existing = await this.prisma.coupon.findUnique({
      where: { code },
    });
    if (existing) {
      throw new ConflictException({
        statusCode: 409,
        message: 'A coupon with this code already exists',
        error: 'CONFLICT',
      });
    }

    return this.prisma.coupon.create({
      data: {
        code,
        descriptionAr: dto.descriptionAr,
        descriptionEn: dto.descriptionEn,
        discountType: dto.discountType,
        discountValue: dto.discountValue,
        minAmount: dto.minAmount ?? 0,
        maxUses: dto.maxUses,
        maxUsesPerUser: dto.maxUsesPerUser,
        serviceIds: dto.serviceIds ?? [],
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        isActive: dto.isActive ?? true,
      },
    });
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
    if (dto.maxUsesPerUser !== undefined) data.maxUsesPerUser = dto.maxUsesPerUser;
    if (dto.serviceIds !== undefined) data.serviceIds = dto.serviceIds;
    if (dto.expiresAt !== undefined) data.expiresAt = new Date(dto.expiresAt);
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    return this.prisma.coupon.update({ where: { id }, data });
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
      where: {
        code: dto.code.toUpperCase(),
        isActive: true,
      },
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

  private buildWhereClause(
    query: CouponFilterDto,
    now: Date,
  ): Record<string, unknown> {
    const where: Record<string, unknown> = {};

    if (query.search) {
      where.code = { contains: query.search, mode: 'insensitive' };
    }

    if (query.status === 'active') {
      where.isActive = true;
      where.OR = [
        { expiresAt: null },
        { expiresAt: { gt: now } },
      ];
    } else if (query.status === 'inactive') {
      where.isActive = false;
    } else if (query.status === 'expired') {
      where.expiresAt = { lte: now };
    }

    return where;
  }

  private validateCouponExpiry(coupon: { expiresAt: Date | null }): void {
    if (coupon.expiresAt && coupon.expiresAt < new Date()) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'Coupon has expired',
        error: 'COUPON_EXPIRED',
      });
    }
  }

  private validateCouponUsageLimit(coupon: {
    maxUses: number | null;
    usedCount: number;
  }): void {
    if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'Coupon usage limit reached',
        error: 'COUPON_LIMIT_REACHED',
      });
    }
  }

  private async validatePerUserLimit(
    coupon: { id: string; maxUsesPerUser: number | null },
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
    coupon: { serviceIds: string[] },
    serviceId?: string,
  ): void {
    if (coupon.serviceIds.length > 0 && serviceId) {
      if (!coupon.serviceIds.includes(serviceId)) {
        throw new BadRequestException({
          statusCode: 400,
          message: 'Coupon is not valid for this service',
          error: 'COUPON_SERVICE_MISMATCH',
        });
      }
    }
  }

  private validateMinAmount(
    coupon: { minAmount: number },
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
    if (discountType === 'percentage') {
      return Math.round((amount * discountValue) / 100);
    }
    return Math.min(discountValue, amount);
  }
}
