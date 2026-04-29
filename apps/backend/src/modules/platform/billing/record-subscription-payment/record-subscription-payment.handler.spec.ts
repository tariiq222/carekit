import { NotFoundException } from '@nestjs/common';
import { RecordSubscriptionPaymentHandler } from './record-subscription-payment.handler';
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
  sendSubscriptionPaymentSucceeded: jest.fn().mockResolvedValue(undefined),
});

const buildConfig = () => ({
  get: jest.fn().mockImplementation((_key: string, def: unknown) => def),
});

describe('RecordSubscriptionPaymentHandler', () => {
  it('throws NotFoundException for unknown invoice', async () => {
    const prisma = buildPrisma();
    prisma.subscriptionInvoice.findFirst.mockResolvedValue(null);
    const handler = new RecordSubscriptionPaymentHandler(
      prisma as never,
      buildCache() as never,
      new SubscriptionStateMachine(),
      buildMailer() as never,
      buildConfig() as never,
    );

    await expect(
      handler.execute({ invoiceId: 'inv-unknown', moyasarPaymentId: 'pay-1' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('transitions TRIALING → ACTIVE on payment', async () => {
    const txPrisma = buildTxPrisma();
    const prisma = buildPrisma(txPrisma);
    prisma.subscriptionInvoice.findFirst.mockResolvedValue({
      id: 'inv-1',
      amountTotal: 299,
      subscription: { id: 'sub-1', status: 'TRIALING', organizationId: 'org-A' },
    });
    const handler = new RecordSubscriptionPaymentHandler(
      prisma as never,
      buildCache() as never,
      new SubscriptionStateMachine(),
      buildMailer() as never,
      buildConfig() as never,
    );

    await handler.execute({ invoiceId: 'inv-1', moyasarPaymentId: 'pay-1' });

    expect(txPrisma.subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'ACTIVE' }),
      }),
    );
  });

  it('transitions PAST_DUE → ACTIVE on payment', async () => {
    const txPrisma = buildTxPrisma();
    const prisma = buildPrisma(txPrisma);
    prisma.subscriptionInvoice.findFirst.mockResolvedValue({
      id: 'inv-1',
      amountTotal: 299,
      subscription: { id: 'sub-1', status: 'PAST_DUE', organizationId: 'org-A' },
    });
    const handler = new RecordSubscriptionPaymentHandler(
      prisma as never,
      buildCache() as never,
      new SubscriptionStateMachine(),
      buildMailer() as never,
      buildConfig() as never,
    );

    await handler.execute({ invoiceId: 'inv-1', moyasarPaymentId: 'pay-1' });

    expect(txPrisma.subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'ACTIVE' }),
      }),
    );
  });

  it('marks invoice as PAID', async () => {
    const txPrisma = buildTxPrisma();
    const prisma = buildPrisma(txPrisma);
    prisma.subscriptionInvoice.findFirst.mockResolvedValue({
      id: 'inv-1',
      subscription: { id: 'sub-1', status: 'ACTIVE', organizationId: 'org-A' },
    });

    // ACTIVE → chargeSuccess is not a valid transition — use PAST_DUE
    const sub = { id: 'sub-1', status: 'PAST_DUE', organizationId: 'org-A' };
    prisma.subscriptionInvoice.findFirst.mockResolvedValue({ id: 'inv-1', amountTotal: 299, subscription: sub });

    const handler = new RecordSubscriptionPaymentHandler(
      prisma as never,
      buildCache() as never,
      new SubscriptionStateMachine(),
      buildMailer() as never,
      buildConfig() as never,
    );

    await handler.execute({ invoiceId: 'inv-1', moyasarPaymentId: 'pay-abc' });

    expect(txPrisma.subscriptionInvoice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'PAID', moyasarPaymentId: 'pay-abc' }),
      }),
    );
  });

  it('clears pastDueSince on successful payment', async () => {
    const txPrisma = buildTxPrisma();
    const prisma = buildPrisma(txPrisma);
    prisma.subscriptionInvoice.findFirst.mockResolvedValue({
      id: 'inv-1',
      amountTotal: 299,
      subscription: { id: 'sub-1', status: 'PAST_DUE', organizationId: 'org-A' },
    });
    const handler = new RecordSubscriptionPaymentHandler(
      prisma as never,
      buildCache() as never,
      new SubscriptionStateMachine(),
      buildMailer() as never,
      buildConfig() as never,
    );

    await handler.execute({ invoiceId: 'inv-1', moyasarPaymentId: 'pay-1' });

    expect(txPrisma.subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ pastDueSince: null }),
      }),
    );
  });

  it('invalidates cache after recording payment', async () => {
    const txPrisma = buildTxPrisma();
    const prisma = buildPrisma(txPrisma);
    const cache = buildCache();
    prisma.subscriptionInvoice.findFirst.mockResolvedValue({
      id: 'inv-1',
      amountTotal: 299,
      subscription: { id: 'sub-1', status: 'TRIALING', organizationId: 'org-A' },
    });
    const handler = new RecordSubscriptionPaymentHandler(
      prisma as never,
      cache as never,
      new SubscriptionStateMachine(),
      buildMailer() as never,
      buildConfig() as never,
    );

    await handler.execute({ invoiceId: 'inv-1', moyasarPaymentId: 'pay-1' });

    expect(cache.invalidate).toHaveBeenCalledWith('org-A');
  });

  it('sends a payment-succeeded email to the org owner', async () => {
    const txPrisma = buildTxPrisma();
    const prisma = buildPrisma(txPrisma);
    prisma.subscriptionInvoice.findFirst.mockResolvedValue({
      id: 'inv-1',
      amountTotal: 299,
      subscription: { id: 'sub-1', status: 'TRIALING', organizationId: 'org-A' },
    });
    const mailer = buildMailer();
    const handler = new RecordSubscriptionPaymentHandler(
      prisma as never,
      buildCache() as never,
      new SubscriptionStateMachine(),
      mailer as never,
      buildConfig() as never,
    );

    await handler.execute({ invoiceId: 'inv-1', moyasarPaymentId: 'pay-1' });

    expect(mailer.sendSubscriptionPaymentSucceeded).toHaveBeenCalledWith(
      'owner@example.com',
      expect.objectContaining({
        amountSar: '299.00',
        invoiceId: 'inv-1',
        receiptUrl: expect.stringContaining('inv-1'),
      }),
    );
  });
});
