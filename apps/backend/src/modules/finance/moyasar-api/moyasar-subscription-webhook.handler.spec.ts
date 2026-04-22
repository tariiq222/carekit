import { createHmac } from 'crypto';
import { UnauthorizedException } from '@nestjs/common';
import { MoyasarSubscriptionWebhookHandler } from './moyasar-subscription-webhook.handler';

const TEST_SECRET = 'test-webhook-secret';
const ORG_ID = 'org-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

function sign(rawBody: string, secret = TEST_SECRET): string {
  return createHmac('sha256', secret).update(rawBody).digest('hex');
}

function buildClient(valid = true) {
  return {
    verifyWebhookSignature: jest.fn().mockReturnValue(valid),
  };
}

function buildSubscription(organizationId = ORG_ID) {
  return { id: 'sub-1', organizationId };
}

function buildInvoice(overrides?: { id?: string; subscription?: ReturnType<typeof buildSubscription> } | null) {
  if (overrides === null) return null;
  return {
    id: 'inv-sub-1',
    subscription: buildSubscription(),
    ...overrides,
  };
}

function buildPrisma(invoice = buildInvoice()) {
  return {
    subscriptionInvoice: {
      findFirst: jest.fn().mockResolvedValue(invoice),
    },
  };
}

function buildCls() {
  const store: Record<string, unknown> = {};
  return {
    run: jest.fn(async (fn: () => Promise<unknown>) => fn()),
    set: jest.fn((key: string, value: unknown) => { store[key] = value; }),
    get: jest.fn((key: string) => store[key]),
  };
}

function buildRecordPayment() {
  return { execute: jest.fn().mockResolvedValue({ ok: true }) };
}

function buildRecordFailure() {
  return { execute: jest.fn().mockResolvedValue({ ok: true }) };
}

function makeHandler(overrides: {
  clientValid?: boolean;
  invoice?: ReturnType<typeof buildInvoice>;
} = {}) {
  const client = buildClient(overrides.clientValid ?? true);
  const prisma = buildPrisma(overrides.invoice ?? buildInvoice());
  const cls = buildCls();
  const recordPayment = buildRecordPayment();
  const recordFailure = buildRecordFailure();

  const handler = new MoyasarSubscriptionWebhookHandler(
    client as never,
    prisma as never,
    cls as never,
    recordPayment as never,
    recordFailure as never,
  );

  return { handler, client, prisma, cls, recordPayment, recordFailure };
}

describe('MoyasarSubscriptionWebhookHandler', () => {
  const paidEvent = { type: 'payment_paid', data: { id: 'mpay-1', status: 'paid' } };
  const failedEvent = { type: 'payment_failed', data: { id: 'mpay-1', status: 'failed', source: { message: 'declined' } } };

  function rawBody(event: object): Buffer {
    return Buffer.from(JSON.stringify(event), 'utf8');
  }

  it('throws UnauthorizedException when signature is invalid', async () => {
    const { handler } = makeHandler({ clientValid: false });
    await expect(
      handler.execute(rawBody(paidEvent), 'bad-sig'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('returns { ok: true } without error for unknown moyasarPaymentId', async () => {
    const { handler } = makeHandler({ invoice: null });
    const result = await handler.execute(rawBody(paidEvent), sign(JSON.stringify(paidEvent)));
    expect(result).toEqual({ ok: true });
  });

  it('calls recordPayment.execute for payment_paid event', async () => {
    const { handler, recordPayment } = makeHandler();
    await handler.execute(rawBody(paidEvent), sign(JSON.stringify(paidEvent)));
    expect(recordPayment.execute).toHaveBeenCalledWith({
      invoiceId: 'inv-sub-1',
      moyasarPaymentId: 'mpay-1',
    });
  });

  it('calls recordFailure.execute for payment_failed event', async () => {
    const { handler, recordFailure } = makeHandler();
    await handler.execute(rawBody(failedEvent), sign(JSON.stringify(failedEvent)));
    expect(recordFailure.execute).toHaveBeenCalledWith({
      invoiceId: 'inv-sub-1',
      moyasarPaymentId: 'mpay-1',
      reason: 'declined',
    });
  });

  it('uses "unknown" as failure reason when source.message is absent', async () => {
    const { handler, recordFailure } = makeHandler();
    const noMsgEvent = { type: 'payment_failed', data: { id: 'mpay-1', status: 'failed' } };
    await handler.execute(rawBody(noMsgEvent), sign(JSON.stringify(noMsgEvent)));
    expect(recordFailure.execute).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'unknown' }),
    );
  });
});
