import { createHmac } from 'crypto';
import { BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { PaymentStatus } from '@prisma/client';
import { MoyasarWebhookHandler, MoyasarWebhookRequest } from './moyasar-webhook.handler';
import { MoyasarWebhookDto } from './moyasar-webhook.dto';

const TEST_SECRET = 'test-secret';

const ORG_A = 'org-a-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const ORG_B = 'org-b-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

function buildInvoice(organizationId: string, id: string = 'inv-1'): Record<string, unknown> {
  return {
    id,
    organizationId,
    bookingId: `booking-${id}`,
    clientId: `client-${id}`,
    currency: 'SAR',
    total: 230,
    status: 'ISSUED',
  };
}

function buildPayment(organizationId: string, id: string = 'pay-1'): Record<string, unknown> {
  return {
    id,
    organizationId,
    invoiceId: 'inv-1',
    status: PaymentStatus.COMPLETED,
  };
}

function buildPrisma(invoiceOverride?: Record<string, unknown> | null) {
  return {
    payment: {
      findFirst: jest.fn().mockResolvedValue(null),
      upsert: jest.fn().mockImplementation(({ create }: { create: Record<string, unknown> }) =>
        Promise.resolve(buildPayment(create.organizationId as string)),
      ),
    },
    invoice: {
      findFirst: jest
        .fn()
        .mockResolvedValue(
          invoiceOverride === null ? null : invoiceOverride ?? buildInvoice(ORG_A),
        ),
      update: jest.fn().mockResolvedValue({ status: 'PAID' }),
    },
  };
}

const buildEventBus = () => ({ publish: jest.fn().mockResolvedValue(undefined) });
const buildConfig = (secret: string = TEST_SECRET) => ({
  get: jest.fn().mockReturnValue(secret),
});

function buildCls() {
  const store: Record<string, unknown> = {};
  return {
    run: jest.fn(async (fn: () => Promise<unknown>) => fn()),
    set: jest.fn((key: string, value: unknown) => {
      store[key] = value;
    }),
    get: jest.fn((key: string) => store[key]),
  };
}

const paidPayload: MoyasarWebhookDto = {
  id: 'moyasar-pay-1',
  status: 'paid',
  amount: 23000,
  currency: 'SAR',
  metadata: { invoiceId: 'inv-1' },
} as MoyasarWebhookDto;

const sign = (rawBody: string, secret: string = TEST_SECRET) =>
  createHmac('sha256', secret).update(rawBody).digest('hex');

function makeReq(payload: MoyasarWebhookDto = paidPayload, rawBody?: string): MoyasarWebhookRequest {
  const body = rawBody ?? JSON.stringify(payload);
  return { payload, rawBody: body, signature: sign(body) };
}

interface HandlerOverrides {
  prisma?: ReturnType<typeof buildPrisma>;
  eventBus?: ReturnType<typeof buildEventBus>;
  config?: { get: jest.Mock };
  cls?: ReturnType<typeof buildCls>;
}

function makeHandler(overrides: HandlerOverrides = {}) {
  const prisma = overrides.prisma ?? buildPrisma();
  const eventBus = overrides.eventBus ?? buildEventBus();
  const config = overrides.config ?? buildConfig();
  const cls = overrides.cls ?? buildCls();
  const handler = new MoyasarWebhookHandler(
    prisma as never,
    eventBus as never,
    config as never,
    cls as never,
  );
  return { handler, prisma, eventBus, config, cls };
}

describe('MoyasarWebhookHandler', () => {
  describe('verifySignature', () => {
    it('passes for valid signature', () => {
      const { handler } = makeHandler();
      const body = '{"id":"test"}';
      expect(() => handler.verifySignature(body, sign(body), TEST_SECRET)).not.toThrow();
    });

    it('throws BadRequestException for invalid signature', () => {
      const { handler } = makeHandler();
      const body = '{"id":"test"}';
      const wrong = sign(body, 'wrong-secret');
      expect(() => handler.verifySignature(body, wrong, TEST_SECRET)).toThrow(BadRequestException);
    });

    it('throws BadRequestException when signature length differs (not timing-attackable)', () => {
      const { handler } = makeHandler();
      expect(() => handler.verifySignature('body', 'deadbeef', TEST_SECRET)).toThrow(
        BadRequestException,
      );
    });
  });

  describe('execute', () => {
    it('processes paid webhook and emits PaymentCompletedEvent', async () => {
      const { handler, prisma, eventBus } = makeHandler();

      const result = await handler.execute(makeReq());

      expect(prisma.payment.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { idempotencyKey: 'moyasar:moyasar-pay-1' },
          create: expect.objectContaining({
            amount: 230,
            status: 'COMPLETED',
            organizationId: ORG_A,
          }),
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

    it('carries organizationId from invoice into the published event envelope', async () => {
      const { handler, eventBus } = makeHandler();
      await handler.execute(makeReq());

      expect(eventBus.publish).toHaveBeenCalledTimes(1);
      const envelope = eventBus.publish.mock.calls[0][1] as { payload: { organizationId: string } };
      expect(envelope.payload.organizationId).toBe(ORG_A);
    });

    it('routes payments to the correct org based on the invoice payload (two-org isolation)', async () => {
      // Org B's invoice — the same webhook handler instance should write the
      // Payment under orgB, never under orgA or DEFAULT_ORG.
      const { handler, prisma, eventBus } = makeHandler({
        prisma: buildPrisma(buildInvoice(ORG_B, 'inv-b')),
      });
      await handler.execute(makeReq({ ...paidPayload, metadata: { invoiceId: 'inv-b' } }));

      expect(prisma.payment.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ organizationId: ORG_B }),
        }),
      );
      const envelope = eventBus.publish.mock.calls[0][1] as { payload: { organizationId: string } };
      expect(envelope.payload.organizationId).toBe(ORG_B);
    });

    it('skips silently when payment already COMPLETED (idempotent)', async () => {
      const prisma = buildPrisma();
      prisma.payment.findFirst = jest.fn().mockResolvedValue(buildPayment(ORG_A));
      const { handler, eventBus } = makeHandler({ prisma });

      const result = await handler.execute(makeReq());

      expect(prisma.payment.upsert).not.toHaveBeenCalled();
      expect(eventBus.publish).not.toHaveBeenCalled();
      expect(result.skipped).toBe(true);
    });

    it('skips when metadata is missing', async () => {
      const { handler } = makeHandler();
      const noMetadata = { ...paidPayload, metadata: undefined };
      const result = await handler.execute(makeReq(noMetadata));
      expect(result.skipped).toBe(true);
    });

    it('skips when invoice is not found (unknown to this deployment)', async () => {
      const { handler, prisma } = makeHandler({ prisma: buildPrisma(null) });
      const result = await handler.execute(makeReq());
      expect(result.skipped).toBe(true);
      expect(prisma.payment.upsert).not.toHaveBeenCalled();
    });

    it('creates failed payment for non-paid status', async () => {
      const { handler, prisma } = makeHandler();
      const failedPayload = {
        ...paidPayload,
        status: 'failed' as const,
        message: 'Declined',
      } as MoyasarWebhookDto;
      await handler.execute(makeReq(failedPayload));

      expect(prisma.payment.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            status: 'FAILED',
            failureReason: 'Declined',
            organizationId: ORG_A,
          }),
        }),
      );
      expect(prisma.invoice.update).not.toHaveBeenCalled();
    });

    it('rejects a webhook with a forged signature', async () => {
      const { handler } = makeHandler();
      const rawBody = JSON.stringify(paidPayload);
      const forged = sign(rawBody, 'attacker-secret');
      await expect(
        handler.execute({ payload: paidPayload, rawBody, signature: forged }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws InternalServerErrorException when MOYASAR_SECRET_KEY is not configured', async () => {
      const emptyConfig = { get: jest.fn().mockReturnValue(undefined) };
      const { handler } = makeHandler({ config: emptyConfig });
      await expect(handler.execute(makeReq())).rejects.toThrow(InternalServerErrorException);
    });

    it('enters system context for tenant resolution (bypass flag set)', async () => {
      const { handler, cls } = makeHandler();
      await handler.execute(makeReq());

      // Stage 2 sets systemContext = true for invoice lookup and idempotency.
      expect(cls.set).toHaveBeenCalledWith('systemContext', true);
      // Stage 3 sets tenant context with resolved orgId.
      expect(cls.set).toHaveBeenCalledWith(
        'tenant',
        expect.objectContaining({ organizationId: ORG_A }),
      );
    });
  });
});
