import { SUPER_ADMIN_CONTEXT_CLS_KEY } from '../../../../common/tenant/tenant.constants';
import { DunningRetryCron } from './dunning-retry.cron';

const NOW = new Date('2026-04-30T12:00:00.000Z');

const buildConfig = (enabled: boolean) => ({
  get: jest.fn((key: string, fallback?: unknown) => {
    if (key === 'BILLING_CRON_ENABLED') return enabled;
    return fallback;
  }),
});

const buildPrisma = (subscriptions: unknown[] = []) => ({
  $allTenants: {
    subscription: {
      findMany: jest.fn().mockResolvedValue(subscriptions),
    },
  },
});

const buildRetryService = () => ({
  retryInvoice: jest.fn().mockResolvedValue({ ok: true, status: 'PAID', attemptNumber: 1 }),
});

const buildCls = () => ({
  run: jest.fn().mockImplementation(async (fn: () => Promise<void>) => fn()),
  set: jest.fn(),
});

describe('DunningRetryCron', () => {
  it('does nothing when billing cron is disabled', async () => {
    const prisma = buildPrisma();
    const retry = buildRetryService();
    const cron = new DunningRetryCron(prisma as never, buildConfig(false) as never, retry as never, buildCls() as never);

    await cron.execute();

    expect(prisma.$allTenants.subscription.findMany).not.toHaveBeenCalled();
    expect(retry.retryInvoice).not.toHaveBeenCalled();
  });

  it('queries PAST_DUE subscriptions with due nextRetryAt', async () => {
    const prisma = buildPrisma([]);
    const cron = new DunningRetryCron(prisma as never, buildConfig(true) as never, buildRetryService() as never, buildCls() as never);

    await cron.execute(NOW);

    expect(prisma.$allTenants.subscription.findMany).toHaveBeenCalledWith({
      where: {
        status: 'PAST_DUE',
        nextRetryAt: { lte: NOW },
      },
      select: {
        id: true,
        organizationId: true,
        dunningRetryCount: true,
        invoices: {
          where: { status: { in: ['FAILED', 'DUE'] } },
          orderBy: { dueDate: 'desc' },
          take: 1,
          select: { id: true, amount: true },
        },
      },
    });
  });

  it('delegates the latest failed invoice to the retry service', async () => {
    const subscription = {
      id: 'sub-1',
      organizationId: 'org-1',
      dunningRetryCount: 0,
      invoices: [{ id: 'inv-1', amount: 299 }],
    };
    const prisma = buildPrisma([subscription]);
    const retry = buildRetryService();
    const cron = new DunningRetryCron(prisma as never, buildConfig(true) as never, retry as never, buildCls() as never);

    await cron.execute(NOW);

    expect(retry.retryInvoice).toHaveBeenCalledWith({
      subscription: {
        id: 'sub-1',
        organizationId: 'org-1',
        dunningRetryCount: 0,
      },
      invoice: { id: 'inv-1', amount: 299 },
      now: NOW,
      manual: false,
    });
  });

  it('skips subscriptions without a failed or due invoice', async () => {
    const prisma = buildPrisma([
      {
        id: 'sub-1',
        organizationId: 'org-1',
        dunningRetryCount: 0,
        invoices: [],
      },
    ]);
    const retry = buildRetryService();
    const cron = new DunningRetryCron(prisma as never, buildConfig(true) as never, retry as never, buildCls() as never);

    await cron.execute(NOW);

    expect(retry.retryInvoice).not.toHaveBeenCalled();
  });

  it('wraps execute body in super-admin CLS context', async () => {
    const prisma = buildPrisma([]);
    const cls = buildCls();
    const cron = new DunningRetryCron(
      prisma as never,
      buildConfig(true) as never,
      buildRetryService() as never,
      cls as never,
    );

    await cron.execute(NOW);

    expect(cls.run).toHaveBeenCalledTimes(1);
    expect(cls.set).toHaveBeenCalledWith(SUPER_ADMIN_CONTEXT_CLS_KEY, true);
  });
});
