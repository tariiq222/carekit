import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

export interface ValidateCouponInput {
  tx: Prisma.TransactionClient;
  code: string;
  orgId: string;
  clientId: string;
  serviceId: string;
  subtotal: number;
}

export interface ValidateCouponResult {
  couponId: string;
  discount: number;
}

@Injectable()
export class ValidateCouponService {
  async validate(input: ValidateCouponInput): Promise<ValidateCouponResult> {
    const coupon = await input.tx.coupon.findFirst({ where: { code: input.code, organizationId: input.orgId } });
    if (!coupon) throw new NotFoundException(`Coupon ${input.code} not found`);
    if (!coupon.isActive) throw new BadRequestException(`Coupon ${input.code} is inactive`);
    if (coupon.expiresAt && coupon.expiresAt < new Date()) {
      throw new BadRequestException(`Coupon ${input.code} has expired`);
    }
    if (coupon.minOrderAmt !== null && input.subtotal < Number(coupon.minOrderAmt)) {
      throw new BadRequestException(`Order does not meet minimum for coupon`);
    }
    if (coupon.serviceIds.length > 0 && !coupon.serviceIds.includes(input.serviceId)) {
      throw new BadRequestException(`Coupon not eligible for this service`);
    }
    if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) {
      throw new BadRequestException(`Coupon usage exhausted`);
    }
    if (coupon.maxUsesPerUser !== null) {
      const used = await input.tx.booking.count({
        where: {
          clientId: input.clientId,
          couponCode: input.code,
          status: { notIn: ['CANCELLED', 'EXPIRED'] },
        },
      });
      if (used >= coupon.maxUsesPerUser) {
        throw new BadRequestException(`Coupon limit per user reached`);
      }
    }
    const discount =
      coupon.discountType === 'PERCENTAGE'
        ? input.subtotal * Number(coupon.discountValue) / 100
        : Math.min(Number(coupon.discountValue), input.subtotal);
    return { couponId: coupon.id, discount: Number(discount.toFixed(2)) };
  }
}
