import { NotFoundException, BadRequestException } from '@nestjs/common';
import { PaymentStatus } from '@prisma/client';
import { RefundPaymentHandler } from './refund-payment/refund-payment.handler';
import { VerifyPaymentHandler } from './verify-payment/verify-payment.handler';

const buildPrisma = () => ({
  payment: {
    findFirst: jest.fn(),
    update: jest.fn(),
  },
});

const TENANT = 'tenant-1';
const PAY_ID = 'pay-1';

describe('RefundPaymentHandler', () => {
  it('refunds a completed payment', async () => {
    const prisma = buildPrisma();
    const completedPayment = { id: PAY_ID, tenantId: TENANT, status: PaymentStatus.COMPLETED };
    const refunded = { ...completedPayment, status: PaymentStatus.REFUNDED, failureReason: 'client request' };
    prisma.payment.findFirst.mockResolvedValue(completedPayment);
    prisma.payment.update.mockResolvedValue(refunded);

    const handler = new RefundPaymentHandler(prisma as never);
    const result = await handler.execute({ tenantId: TENANT, paymentId: PAY_ID, reason: 'client request' });

    expect(result.status).toBe(PaymentStatus.REFUNDED);
    expect(prisma.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: PAY_ID },
        data: expect.objectContaining({ status: PaymentStatus.REFUNDED, failureReason: 'client request' }),
      }),
    );
  });

  it('throws NotFoundException when payment not found', async () => {
    const prisma = buildPrisma();
    prisma.payment.findFirst.mockResolvedValue(null);

    await expect(
      new RefundPaymentHandler(prisma as never).execute({ tenantId: TENANT, paymentId: 'bad', reason: 'x' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws BadRequestException when payment is not COMPLETED', async () => {
    const prisma = buildPrisma();
    prisma.payment.findFirst.mockResolvedValue({ id: PAY_ID, tenantId: TENANT, status: PaymentStatus.PENDING });

    await expect(
      new RefundPaymentHandler(prisma as never).execute({ tenantId: TENANT, paymentId: PAY_ID, reason: 'x' }),
    ).rejects.toThrow(BadRequestException);
  });
});

describe('VerifyPaymentHandler', () => {
  it('verifies a pending_verification payment', async () => {
    const prisma = buildPrisma();
    const pendingPayment = { id: PAY_ID, tenantId: TENANT, status: PaymentStatus.PENDING_VERIFICATION, gatewayRef: null };
    const verified = { ...pendingPayment, status: PaymentStatus.COMPLETED, processedAt: new Date(), gatewayRef: 'REF-123' };
    prisma.payment.findFirst.mockResolvedValue(pendingPayment);
    prisma.payment.update.mockResolvedValue(verified);

    const handler = new VerifyPaymentHandler(prisma as never);
    const result = await handler.execute({ tenantId: TENANT, paymentId: PAY_ID, transferRef: 'REF-123' });

    expect(result.status).toBe(PaymentStatus.COMPLETED);
    expect(prisma.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: PAY_ID },
        data: expect.objectContaining({ status: PaymentStatus.COMPLETED, gatewayRef: 'REF-123' }),
      }),
    );
  });

  it('throws NotFoundException when payment not found', async () => {
    const prisma = buildPrisma();
    prisma.payment.findFirst.mockResolvedValue(null);

    await expect(
      new VerifyPaymentHandler(prisma as never).execute({ tenantId: TENANT, paymentId: 'bad' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws BadRequestException when payment is not PENDING_VERIFICATION', async () => {
    const prisma = buildPrisma();
    prisma.payment.findFirst.mockResolvedValue({ id: PAY_ID, tenantId: TENANT, status: PaymentStatus.COMPLETED, gatewayRef: null });

    await expect(
      new VerifyPaymentHandler(prisma as never).execute({ tenantId: TENANT, paymentId: PAY_ID }),
    ).rejects.toThrow(BadRequestException);
  });
});
