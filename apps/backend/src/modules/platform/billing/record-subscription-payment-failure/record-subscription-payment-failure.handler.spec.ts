import { NotFoundException } from '@nestjs/common';
import { RecordSubscriptionPaymentFailureHandler } from './record-subscription-payment-failure.handler';
import { SubscriptionStateMachine } from '../subscription-state-machine';

const buildTxPrisma = () => ({
  subscriptionInvoice: {
    update: jest.fn().mockResolvedValue({}),
  },
  subscription: {
    update: jest.fn().mockResolvedValue({}),
  },
});

const buildPrisma = (txPrisma = buildTxPrisma()) => ({
  subscriptionInvoice: {
    findFirst: jest.fn(),
  },
  $transaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) => fn(txPrisma)),
  _txPrisma: txPrisma,
  $allTenants: {
    membership: {
      findFirst: jest.fn().mockResolvedValue({
        user: { email: 'owner@example.com', name: 'Owner' },
        organization: { nameAr: 'Org AR' },
      }),
    },
  },
});

const buildCache = () => ({
  invalidate: jest.fn(),
});

const buildMailer = () => ({
  sendSubscriptionPaymentFailed: jest.fn().mockResolvedValue(undefined),
});

const buildConfig = () => ({
  get: jest.fn().mockImplementation((_key: string, def: unknown) => def),
});

const baseCmd = {
  invoiceId: 'inv-1',
  moyasarPaymentId: 'pay-fail-1',
  reason: 'Insufficient funds',
};

describe('RecordSubscriptionPaymentFailureHandler', () => {
  it('throws NotFoundException for unknown invoice', async () => {
    const prisma = buildPrisma();
    prisma.subscriptionInvoice.findFirst.mockResolvedValue(null);
    const handler = new RecordSubscriptionPaymentFailureHandler(
      prisma as never,
      buildCache() as never,
      new SubscriptionStateMachine(),
      buildMailer() as never,
      buildConfig() as never,
    );

    await expect(handler.execute(baseCmd)).rejects.toThrow(NotFoundException);
  });

  it('transitions ACTIVE → PAST_DUE on charge failure', async () => {
    const txPrisma = buildTxPrisma();
    const prisma = buildPrisma(txPrisma);
    prisma.subscriptionInvoice.findFirst.mockResolvedValue({
      id: 'inv-1',
      amountTotal: 299,
      subscription: {
        id: 'sub-1',
        status: 'ACTIVE',
        organizationId: 'org-A',
        pastDueSince: null,
      },
    });
    const handler = new RecordSubscriptionPaymentFailureHandler(
      prisma as never,
      buildCache() as never,
      new SubscriptionStateMachine(),
      buildMailer() as never,
      buildConfig() as never,
    );

    await handler.execute(baseCmd);

    expect(txPrisma.subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'PAST_DUE' }),
      }),
    );
  });

  it('sets pastDueSince only on first failure (when null)', async () => {
    const txPrisma = buildTxPrisma();
    const prisma = buildPrisma(txPrisma);
    prisma.subscriptionInvoice.findFirst.mockResolvedValue({
      id: 'inv-1',
      amountTotal: 299,
      subscription: {
        id: 'sub-1',
        status: 'ACTIVE',
        organizationId: 'org-A',
        pastDueSince: null,
      },
    });
    const handler = new RecordSubscriptionPaymentFailureHandler(
      prisma as never,
      buildCache() as never,
      new SubscriptionStateMachine(),
      buildMailer() as never,
      buildConfig() as never,
    );

    await handler.execute(baseCmd);

    const updateCall = txPrisma.subscription.update.mock.calls[0][0];
    expect(updateCall.data.pastDueSince).toBeInstanceOf(Date);
  });

  it('does not overwrite pastDueSince on subsequent failures', async () => {
    const txPrisma = buildTxPrisma();
    const prisma = buildPrisma(txPrisma);
    const existingPastDue = new Date('2026-04-20T00:00:00Z');
    prisma.subscriptionInvoice.findFirst.mockResolvedValue({
      id: 'inv-1',
      amountTotal: 299,
      subscription: {
        id: 'sub-1',
        status: 'ACTIVE',
        organizationId: 'org-A',
        pastDueSince: existingPastDue,
      },
    });
    const handler = new RecordSubscriptionPaymentFailureHandler(
      prisma as never,
      buildCache() as never,
      new SubscriptionStateMachine(),
      buildMailer() as never,
      buildConfig() as never,
    );

    await handler.execute(baseCmd);

    const updateCall = txPrisma.subscription.update.mock.calls[0][0];
    expect(updateCall.data.pastDueSince).toEqual(existingPastDue);
  });

  it('marks invoice as FAILED and increments attemptCount', async () => {
    const txPrisma = buildTxPrisma();
    const prisma = buildPrisma(txPrisma);
    prisma.subscriptionInvoice.findFirst.mockResolvedValue({
      id: 'inv-1',
      amountTotal: 299,
      subscription: {
        id: 'sub-1',
        status: 'ACTIVE',
        organizationId: 'org-A',
        pastDueSince: null,
      },
    });
    const handler = new RecordSubscriptionPaymentFailureHandler(
      prisma as never,
      buildCache() as never,
      new SubscriptionStateMachine(),
      buildMailer() as never,
      buildConfig() as never,
    );

    await handler.execute(baseCmd);

    expect(txPrisma.subscriptionInvoice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'FAILED',
          failureReason: 'Insufficient funds',
          attemptCount: { increment: 1 },
        }),
      }),
    );
  });

  it('invalidates cache after recording failure', async () => {
    const txPrisma = buildTxPrisma();
    const prisma = buildPrisma(txPrisma);
    const cache = buildCache();
    prisma.subscriptionInvoice.findFirst.mockResolvedValue({
      id: 'inv-1',
      amountTotal: 299,
      subscription: {
        id: 'sub-1',
        status: 'ACTIVE',
        organizationId: 'org-A',
        pastDueSince: null,
      },
    });
    const handler = new RecordSubscriptionPaymentFailureHandler(
      prisma as never,
      cache as never,
      new SubscriptionStateMachine(),
      buildMailer() as never,
      buildConfig() as never,
    );

    await handler.execute(baseCmd);

    expect(cache.invalidate).toHaveBeenCalledWith('org-A');
  });

  it('sends a payment-failed email to the org owner', async () => {
    const txPrisma = buildTxPrisma();
    const prisma = buildPrisma(txPrisma);
    prisma.subscriptionInvoice.findFirst.mockResolvedValue({
      id: 'inv-1',
      amountTotal: 299,
      subscription: {
        id: 'sub-1',
        status: 'ACTIVE',
        organizationId: 'org-A',
        pastDueSince: null,
      },
    });
    const mailer = buildMailer();
    const handler = new RecordSubscriptionPaymentFailureHandler(
      prisma as never,
      buildCache() as never,
      new SubscriptionStateMachine(),
      mailer as never,
      buildConfig() as never,
    );

    await handler.execute({ invoiceId: 'inv-1', moyasarPaymentId: 'pay-fail-1', reason: 'Card declined' });

    expect(mailer.sendSubscriptionPaymentFailed).toHaveBeenCalledWith(
      'owner@example.com',
      expect.objectContaining({
        amountSar: '299.00',
        reason: 'Card declined',
        billingUrl: expect.stringContaining('billing'),
      }),
    );
  });
});
