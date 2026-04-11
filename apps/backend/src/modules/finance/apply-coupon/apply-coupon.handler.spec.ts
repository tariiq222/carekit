import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ApplyCouponHandler } from './apply-coupon.handler';

const mockInvoice = {
  id: 'inv-1', tenantId: 'tenant-1', subtotal: 200, discountAmt: 0, vatRate: 0.15, vatAmt: 30, total: 230,
};
const mockCoupon = {
  id: 'coupon-1', tenantId: 'tenant-1', code: 'SAVE10', isActive: true,
  discountType: 'PERCENTAGE', discountValue: 10, expiresAt: null, maxUses: null, usedCount: 0, minOrderAmt: null,
};
const mockRedemption = { id: 'red-1', couponId: 'coupon-1', invoiceId: 'inv-1', discount: 20 };

const buildPrisma = () => ({
  invoice: { findUnique: jest.fn().mockResolvedValue(mockInvoice), update: jest.fn() },
  coupon: { findUnique: jest.fn().mockResolvedValue(mockCoupon), update: jest.fn() },
  couponRedemption: {
    findUnique: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue(mockRedemption),
  },
  $transaction: jest.fn((ops: unknown[]) => Promise.all(ops)),
});

const cmd = { tenantId: 'tenant-1', invoiceId: 'inv-1', clientId: 'client-1', code: 'SAVE10' };

describe('ApplyCouponHandler', () => {
  it('applies percentage coupon and returns redemption', async () => {
    const prisma = buildPrisma();
    const handler = new ApplyCouponHandler(prisma as never);
    const result = await handler.execute(cmd);
    expect(prisma.couponRedemption.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ discount: 20 }) }),
    );
    expect(result.id).toBe('red-1');
  });

  it('throws NotFoundException when invoice not found', async () => {
    const prisma = buildPrisma();
    prisma.invoice.findUnique = jest.fn().mockResolvedValue(null);
    await expect(new ApplyCouponHandler(prisma as never).execute(cmd)).rejects.toThrow(NotFoundException);
  });

  it('throws NotFoundException when coupon not found', async () => {
    const prisma = buildPrisma();
    prisma.coupon.findUnique = jest.fn().mockResolvedValue(null);
    await expect(new ApplyCouponHandler(prisma as never).execute(cmd)).rejects.toThrow(NotFoundException);
  });

  it('throws BadRequestException when coupon expired', async () => {
    const prisma = buildPrisma();
    prisma.coupon.findUnique = jest.fn().mockResolvedValue({ ...mockCoupon, expiresAt: new Date('2020-01-01') });
    await expect(new ApplyCouponHandler(prisma as never).execute(cmd)).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException when max uses reached', async () => {
    const prisma = buildPrisma();
    prisma.coupon.findUnique = jest.fn().mockResolvedValue({ ...mockCoupon, maxUses: 10, usedCount: 10 });
    await expect(new ApplyCouponHandler(prisma as never).execute(cmd)).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException when coupon already applied', async () => {
    const prisma = buildPrisma();
    prisma.couponRedemption.findUnique = jest.fn().mockResolvedValue(mockRedemption);
    await expect(new ApplyCouponHandler(prisma as never).execute(cmd)).rejects.toThrow(BadRequestException);
  });
});
