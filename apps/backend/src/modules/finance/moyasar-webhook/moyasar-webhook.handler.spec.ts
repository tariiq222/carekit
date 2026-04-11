import { createHmac } from 'crypto';
import { BadRequestException } from '@nestjs/common';
import { PaymentStatus } from '@prisma/client';
import { MoyasarWebhookHandler, MoyasarWebhookRequest } from './moyasar-webhook.handler';

const mockInvoice = {
  id: 'inv-1',
  tenantId: 'tenant-1',
  bookingId: 'booking-1',
  currency: 'SAR',
  total: 230,
  status: 'ISSUED',
};

const mockPayment = {
  id: 'pay-1',
  tenantId: 'tenant-1',
  invoiceId: 'inv-1',
  status: PaymentStatus.COMPLETED,
};

const buildPrisma = () => ({
  payment: {
    findFirst: jest.fn().mockResolvedValue(null),
    upsert: jest.fn().mockResolvedValue(mockPayment),
  },
  invoice: {
    findUnique: jest.fn().mockResolvedValue(mockInvoice),
    update: jest.fn().mockResolvedValue({ ...mockInvoice, status: 'PAID' }),
  },
});

const buildEventBus = () => ({ publish: jest.fn().mockResolvedValue(undefined) });
// Config with no secret — signature verification skipped in tests
const buildConfig = () => ({ get: jest.fn().mockReturnValue(undefined) });

const paidPayload = {
  id: 'moyasar-pay-1',
  status: 'paid' as const,
  amount: 23000,
  currency: 'SAR',
  metadata: { invoiceId: 'inv-1', tenantId: 'tenant-1' },
};

const makeReq = (payload = paidPayload, rawBody = '{}', signature = ''): MoyasarWebhookRequest =>
  ({ payload, rawBody, signature });

describe('MoyasarWebhookHandler', () => {
  describe('verifySignature', () => {
    it('passes for valid signature', () => {
      const handler = new MoyasarWebhookHandler(buildPrisma() as never, buildEventBus() as never, buildConfig() as never);
      const body = '{"id":"test"}';
      const secret = 'test-secret';
      const sig = createHmac('sha256', secret).update(body).digest('hex');
      expect(() => handler.verifySignature(body, sig, secret)).not.toThrow();
    });

    it('throws BadRequestException for invalid signature', () => {
      const handler = new MoyasarWebhookHandler(buildPrisma() as never, buildEventBus() as never, buildConfig() as never);
      expect(() => handler.verifySignature('body', 'bad-sig', 'secret')).toThrow(BadRequestException);
    });
  });

  describe('execute', () => {
    it('processes paid webhook and emits PaymentCompletedEvent', async () => {
      const prisma = buildPrisma();
      const eventBus = buildEventBus();
      const handler = new MoyasarWebhookHandler(prisma as never, eventBus as never, buildConfig() as never);

      const result = await handler.execute(makeReq());

      expect(prisma.payment.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { idempotencyKey: 'moyasar:moyasar-pay-1' },
          create: expect.objectContaining({ amount: 230, status: 'COMPLETED' }),
        }),
      );
      expect(prisma.invoice.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'PAID' }) }),
      );
      expect(eventBus.publish).toHaveBeenCalledWith('finance.payment.completed', expect.anything());
      expect(result.skipped).toBeUndefined();
    });

    it('skips silently when payment already COMPLETED (idempotent)', async () => {
      const prisma = buildPrisma();
      prisma.payment.findFirst = jest.fn().mockResolvedValue(mockPayment);
      const eventBus = buildEventBus();
      const handler = new MoyasarWebhookHandler(prisma as never, eventBus as never, buildConfig() as never);

      const result = await handler.execute(makeReq());

      expect(prisma.payment.upsert).not.toHaveBeenCalled();
      expect(eventBus.publish).not.toHaveBeenCalled();
      expect(result.skipped).toBe(true);
    });

    it('skips when metadata is missing', async () => {
      const handler = new MoyasarWebhookHandler(buildPrisma() as never, buildEventBus() as never, buildConfig() as never);
      const result = await handler.execute(makeReq({ ...paidPayload, metadata: undefined }));
      expect(result.skipped).toBe(true);
    });

    it('creates failed payment for non-paid status', async () => {
      const prisma = buildPrisma();
      const handler = new MoyasarWebhookHandler(prisma as never, buildEventBus() as never, buildConfig() as never);

      await handler.execute(makeReq({ ...paidPayload, status: 'failed', message: 'Declined' }));

      expect(prisma.payment.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ status: 'FAILED', failureReason: 'Declined' }),
        }),
      );
      expect(prisma.invoice.update).not.toHaveBeenCalled();
    });

    it('enforces signature when MOYASAR_SECRET_KEY is set', async () => {
      const config = { get: jest.fn().mockReturnValue('my-secret') };
      const handler = new MoyasarWebhookHandler(buildPrisma() as never, buildEventBus() as never, config as never);
      const rawBody = JSON.stringify(paidPayload);
      const badSig = 'bad-signature';
      await expect(handler.execute({ payload: paidPayload, rawBody, signature: badSig })).rejects.toThrow(BadRequestException);
    });
  });
});
