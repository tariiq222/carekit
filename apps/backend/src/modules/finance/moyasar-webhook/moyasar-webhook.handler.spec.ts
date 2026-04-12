import { createHmac } from 'crypto';
import { BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { PaymentStatus } from '@prisma/client';
import { MoyasarWebhookHandler, MoyasarWebhookRequest } from './moyasar-webhook.handler';
import { MoyasarWebhookDto } from './moyasar-webhook.dto';

const TEST_SECRET = 'test-secret';

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
const buildConfig = (secret: string | undefined = TEST_SECRET) => ({
  get: jest.fn().mockReturnValue(secret),
});

const paidPayload: MoyasarWebhookDto = {
  id: 'moyasar-pay-1',
  status: 'paid',
  amount: 23000,
  currency: 'SAR',
  metadata: { invoiceId: 'inv-1', tenantId: 'tenant-1' },
};

const sign = (rawBody: string, secret = TEST_SECRET) =>
  createHmac('sha256', secret).update(rawBody).digest('hex');

const makeReq = (
  payload: MoyasarWebhookDto = paidPayload,
  rawBody?: string,
): MoyasarWebhookRequest => {
  const body = rawBody ?? JSON.stringify(payload);
  return { payload, rawBody: body, signature: sign(body) };
};

describe('MoyasarWebhookHandler', () => {
  describe('verifySignature', () => {
    it('passes for valid signature', () => {
      const handler = new MoyasarWebhookHandler(
        buildPrisma() as never,
        buildEventBus() as never,
        buildConfig() as never,
      );
      const body = '{"id":"test"}';
      expect(() => handler.verifySignature(body, sign(body), TEST_SECRET)).not.toThrow();
    });

    it('throws BadRequestException for invalid signature', () => {
      const handler = new MoyasarWebhookHandler(
        buildPrisma() as never,
        buildEventBus() as never,
        buildConfig() as never,
      );
      const body = '{"id":"test"}';
      const wrong = sign(body, 'wrong-secret');
      expect(() => handler.verifySignature(body, wrong, TEST_SECRET)).toThrow(BadRequestException);
    });

    it('throws BadRequestException when signature length differs (not timing-attackable)', () => {
      const handler = new MoyasarWebhookHandler(
        buildPrisma() as never,
        buildEventBus() as never,
        buildConfig() as never,
      );
      expect(() => handler.verifySignature('body', 'deadbeef', TEST_SECRET)).toThrow(
        BadRequestException,
      );
    });
  });

  describe('execute', () => {
    it('processes paid webhook and emits PaymentCompletedEvent', async () => {
      const prisma = buildPrisma();
      const eventBus = buildEventBus();
      const handler = new MoyasarWebhookHandler(
        prisma as never,
        eventBus as never,
        buildConfig() as never,
      );

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
      expect(eventBus.publish).toHaveBeenCalledWith(
        'finance.payment.completed',
        expect.anything(),
      );
      expect(result.skipped).toBeUndefined();
    });

    it('skips silently when payment already COMPLETED (idempotent)', async () => {
      const prisma = buildPrisma();
      prisma.payment.findFirst = jest.fn().mockResolvedValue(mockPayment);
      const eventBus = buildEventBus();
      const handler = new MoyasarWebhookHandler(
        prisma as never,
        eventBus as never,
        buildConfig() as never,
      );

      const result = await handler.execute(makeReq());

      expect(prisma.payment.upsert).not.toHaveBeenCalled();
      expect(eventBus.publish).not.toHaveBeenCalled();
      expect(result.skipped).toBe(true);
    });

    it('skips when metadata is missing', async () => {
      const handler = new MoyasarWebhookHandler(
        buildPrisma() as never,
        buildEventBus() as never,
        buildConfig() as never,
      );
      const noMetadata = { ...paidPayload, metadata: undefined };
      const result = await handler.execute(makeReq(noMetadata));
      expect(result.skipped).toBe(true);
    });

    it('creates failed payment for non-paid status', async () => {
      const prisma = buildPrisma();
      const handler = new MoyasarWebhookHandler(
        prisma as never,
        buildEventBus() as never,
        buildConfig() as never,
      );
      const failedPayload: MoyasarWebhookDto = { ...paidPayload, status: 'failed', message: 'Declined' };
      await handler.execute(makeReq(failedPayload));

      expect(prisma.payment.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ status: 'FAILED', failureReason: 'Declined' }),
        }),
      );
      expect(prisma.invoice.update).not.toHaveBeenCalled();
    });

    it('rejects a webhook with a forged signature', async () => {
      const handler = new MoyasarWebhookHandler(
        buildPrisma() as never,
        buildEventBus() as never,
        buildConfig() as never,
      );
      const rawBody = JSON.stringify(paidPayload);
      const forged = sign(rawBody, 'attacker-secret');
      await expect(
        handler.execute({ payload: paidPayload, rawBody, signature: forged }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws InternalServerErrorException when MOYASAR_SECRET_KEY is not configured', async () => {
      const emptyConfig = { get: jest.fn().mockReturnValue(undefined) };
      const handler = new MoyasarWebhookHandler(
        buildPrisma() as never,
        buildEventBus() as never,
        emptyConfig as never,
      );
      await expect(handler.execute(makeReq())).rejects.toThrow(InternalServerErrorException);
    });
  });
});
