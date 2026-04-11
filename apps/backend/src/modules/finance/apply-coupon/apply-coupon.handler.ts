import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';

export interface ApplyCouponCommand {
  tenantId: string;
  invoiceId: string;
  clientId: string;
  code: string;
}

@Injectable()
export class ApplyCouponHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(cmd: ApplyCouponCommand) {
    const invoice = await this.prisma.invoice.findUnique({ where: { id: cmd.invoiceId } });
    if (!invoice || invoice.tenantId !== cmd.tenantId) {
      throw new NotFoundException(`Invoice ${cmd.invoiceId} not found`);
    }

    const coupon = await this.prisma.coupon.findUnique({
      where: { tenantId_code: { tenantId: cmd.tenantId, code: cmd.code } },
    });
    if (!coupon || !coupon.isActive) throw new NotFoundException(`Coupon ${cmd.code} not found`);
    if (coupon.expiresAt && coupon.expiresAt < new Date()) {
      throw new BadRequestException(`Coupon ${cmd.code} has expired`);
    }
    if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) {
      throw new BadRequestException(`Coupon ${cmd.code} has reached its usage limit`);
    }
    if (coupon.minOrderAmt !== null && Number(invoice.subtotal) < Number(coupon.minOrderAmt)) {
      throw new BadRequestException(`Order total does not meet minimum for coupon ${cmd.code}`);
    }

    const existing = await this.prisma.couponRedemption.findUnique({
      where: { couponId_invoiceId: { couponId: coupon.id, invoiceId: cmd.invoiceId } },
    });
    if (existing) throw new BadRequestException(`Coupon already applied to this invoice`);

    const discount =
      coupon.discountType === 'PERCENTAGE'
        ? parseFloat((Number(invoice.subtotal) * Number(coupon.discountValue) / 100).toFixed(2))
        : Math.min(Number(coupon.discountValue), Number(invoice.subtotal));

    const newDiscountAmt = parseFloat((Number(invoice.discountAmt) + discount).toFixed(2));
    const newVatBase = Math.max(0, Number(invoice.subtotal) - newDiscountAmt);
    const newVatAmt = parseFloat((newVatBase * Number(invoice.vatRate)).toFixed(2));
    const newTotal = parseFloat((newVatBase + newVatAmt).toFixed(2));

    const [redemption] = await this.prisma.$transaction([
      this.prisma.couponRedemption.create({
        data: {
          tenantId: cmd.tenantId,
          couponId: coupon.id,
          invoiceId: cmd.invoiceId,
          clientId: cmd.clientId,
          discount,
        },
      }),
      this.prisma.coupon.update({
        where: { id: coupon.id },
        data: { usedCount: { increment: 1 } },
      }),
      this.prisma.invoice.update({
        where: { id: cmd.invoiceId },
        data: { discountAmt: newDiscountAmt, vatAmt: newVatAmt, total: newTotal },
      }),
    ]);

    return redemption;
  }
}
