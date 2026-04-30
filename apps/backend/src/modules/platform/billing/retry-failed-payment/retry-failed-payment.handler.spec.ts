import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { RetryFailedPaymentHandler } from './retry-failed-payment.handler';

const NOW = new Date('2026-04-30T12:00:00.000Z');

const buildTenant = () => ({
  requireOrganizationId: jest.fn().mockReturnValue('org-1'),
});

const buildPrisma = (subscription: unknown = null) => ({
  subscription: {
    findFirst: jest.fn().mockResolvedValue(subscription),
  },
});

const buildRetryService = () => ({
  retryInvoice: jest.fn().mockResolvedValue({ ok: true, status: 'PAID', attemptNumber: 1 }),
});

const buildHandler = (
  prisma = buildPrisma(),
  retry = buildRetryService(),
  tenant = buildTenant(),
) => new RetryFailedPaymentHandler(prisma as never, tenant as never, retry as never);

const pastDueSubscription = {
  id: 'sub-1',
  organizationId: 'org-1',
  status: 'PAST_DUE',
  dunningRetryCount: 0,
  nextRetryAt: new Date('2026-05-01T12:00:00.000Z'),
  invoices: [{ id: 'inv-1', amount: 299 }],
};

describe('RetryFailedPaymentHandler', () => {
  it('throws NotFoundException when the tenant has no subscription', async () => {
    const handler = buildHandler(buildPrisma(null));

    await expect(handler.execute(NOW)).rejects.toThrow(NotFoundException);
  });

  it('rejects subscriptions that are not PAST_DUE', async () => {
    const handler = buildHandler(buildPrisma({ ...pastDueSubscription, status: 'ACTIVE' }));

    await expect(handler.execute(NOW)).rejects.toThrow(UnprocessableEntityException);
  });

  it('rejects exhausted retry budgets', async () => {
    const handler = buildHandler(
      buildPrisma({ ...pastDueSubscription, dunningRetryCount: 4 }),
    );

    await expect(handler.execute(NOW)).rejects.toThrow(UnprocessableEntityException);
  });

  it('delegates to dunning retry service even when nextRetryAt is in the future', async () => {
    const prisma = buildPrisma(pastDueSubscription);
    const retry = buildRetryService();
    const handler = buildHandler(prisma, retry);

    await expect(handler.execute(NOW)).resolves.toEqual({
      ok: true,
      status: 'PAID',
      attemptNumber: 1,
    });

    expect(prisma.subscription.findFirst).toHaveBeenCalledWith({
      where: { organizationId: 'org-1' },
      select: {
        id: true,
        organizationId: true,
        status: true,
        dunningRetryCount: true,
        nextRetryAt: true,
        invoices: {
          where: { status: { in: ['FAILED', 'DUE'] } },
          orderBy: { dueDate: 'desc' },
          take: 1,
          select: { id: true, amount: true },
        },
      },
    });
    expect(retry.retryInvoice).toHaveBeenCalledWith({
      subscription: {
        id: 'sub-1',
        organizationId: 'org-1',
        dunningRetryCount: 0,
      },
      invoice: { id: 'inv-1', amount: 299 },
      now: NOW,
      manual: true,
    });
  });

  it('rejects when there is no failed or due invoice to retry', async () => {
    const handler = buildHandler(
      buildPrisma({ ...pastDueSubscription, invoices: [] }),
    );

    await expect(handler.execute(NOW)).rejects.toThrow(UnprocessableEntityException);
  });
});
