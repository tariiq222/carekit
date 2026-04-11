import { NotFoundException, BadRequestException } from '@nestjs/common';
import { RedeemGiftCardHandler } from './redeem-gift-card.handler';

const mockInvoice = { id: 'inv-1', tenantId: 'tenant-1', total: 230, currency: 'SAR' };
const mockGiftCard = {
  id: 'gc-1', tenantId: 'tenant-1', code: 'GC123', isActive: true,
  balance: 100, currency: 'SAR', expiresAt: null,
};
const mockRedemption = { id: 'red-1', giftCardId: 'gc-1', invoiceId: 'inv-1', amount: 100 };

const buildPrisma = () => ({
  invoice: { findUnique: jest.fn().mockResolvedValue(mockInvoice) },
  giftCard: { findUnique: jest.fn().mockResolvedValue(mockGiftCard), update: jest.fn() },
  giftCardRedemption: { create: jest.fn().mockResolvedValue(mockRedemption) },
  payment: { create: jest.fn().mockResolvedValue({ id: 'pay-1' }) },
  $transaction: jest.fn((ops: unknown[]) => Promise.all(ops)),
});

const cmd = { tenantId: 'tenant-1', invoiceId: 'inv-1', clientId: 'client-1', code: 'GC123', amount: 100 };

describe('RedeemGiftCardHandler', () => {
  it('redeems gift card up to available balance', async () => {
    const prisma = buildPrisma();
    const handler = new RedeemGiftCardHandler(prisma as never);
    const result = await handler.execute(cmd);
    expect(prisma.giftCardRedemption.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ amount: 100 }) }),
    );
    expect(prisma.payment.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ amount: 100, method: 'GIFT_CARD' }) }),
    );
    expect(result.id).toBe('red-1');
  });

  it('caps redemption at gift card balance', async () => {
    const prisma = buildPrisma();
    prisma.giftCard.findUnique = jest.fn().mockResolvedValue({ ...mockGiftCard, balance: 50 });
    const handler = new RedeemGiftCardHandler(prisma as never);
    await handler.execute(cmd);
    expect(prisma.giftCardRedemption.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ amount: 50 }) }),
    );
  });

  it('throws NotFoundException when invoice not found', async () => {
    const prisma = buildPrisma();
    prisma.invoice.findUnique = jest.fn().mockResolvedValue(null);
    await expect(new RedeemGiftCardHandler(prisma as never).execute(cmd)).rejects.toThrow(NotFoundException);
  });

  it('throws NotFoundException when gift card not found', async () => {
    const prisma = buildPrisma();
    prisma.giftCard.findUnique = jest.fn().mockResolvedValue(null);
    await expect(new RedeemGiftCardHandler(prisma as never).execute(cmd)).rejects.toThrow(NotFoundException);
  });

  it('throws BadRequestException when gift card expired', async () => {
    const prisma = buildPrisma();
    prisma.giftCard.findUnique = jest.fn().mockResolvedValue({ ...mockGiftCard, expiresAt: new Date('2020-01-01') });
    await expect(new RedeemGiftCardHandler(prisma as never).execute(cmd)).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException when gift card balance is zero', async () => {
    const prisma = buildPrisma();
    prisma.giftCard.findUnique = jest.fn().mockResolvedValue({ ...mockGiftCard, balance: 0 });
    await expect(new RedeemGiftCardHandler(prisma as never).execute(cmd)).rejects.toThrow(BadRequestException);
  });
});
