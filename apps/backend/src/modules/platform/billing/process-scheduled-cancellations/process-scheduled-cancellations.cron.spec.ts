import { ProcessScheduledCancellationsCron } from './process-scheduled-cancellations.cron';

const NOW = new Date('2026-05-01T00:00:00.000Z');

const buildConfig = (enabled: boolean) => ({
  get: jest.fn((key: string, fallback?: unknown) => {
    if (key === 'BILLING_CRON_ENABLED') return enabled;
    return fallback;
  }),
});

const buildPrisma = (subs: unknown[] = []) => ({
  $allTenants: {
    subscription: {
      findMany: jest.fn().mockResolvedValue(subs),
      update: jest.fn().mockResolvedValue({}),
    },
  },
});

const buildCache = () => ({
  invalidate: jest.fn(),
});

describe('ProcessScheduledCancellationsCron', () => {
  beforeEach(() => jest.useFakeTimers().setSystemTime(NOW));
  afterEach(() => jest.useRealTimers());

  it('does nothing when billing cron is disabled', async () => {
    const prisma = buildPrisma([{ id: 'sub-1' }]);
    const cron = new ProcessScheduledCancellationsCron(
      prisma as never,
      buildConfig(false) as never,
      buildCache() as never,
    );

    await cron.execute();

    expect(prisma.$allTenants.subscription.findMany).not.toHaveBeenCalled();
  });

  it('queries due active scheduled cancellations only', async () => {
    const prisma = buildPrisma([]);
    const cron = new ProcessScheduledCancellationsCron(
      prisma as never,
      buildConfig(true) as never,
      buildCache() as never,
    );

    await cron.execute();

    expect(prisma.$allTenants.subscription.findMany).toHaveBeenCalledWith({
      where: {
        status: { in: ['ACTIVE', 'PAST_DUE'] },
        cancelAtPeriodEnd: true,
        scheduledCancellationDate: { lte: NOW },
      },
      select: { id: true, organizationId: true },
    });
  });

  it('cancels due subscriptions and invalidates each tenant cache', async () => {
    const prisma = buildPrisma([{ id: 'sub-1', organizationId: 'org-1' }]);
    const cache = buildCache();
    const cron = new ProcessScheduledCancellationsCron(
      prisma as never,
      buildConfig(true) as never,
      cache as never,
    );

    await cron.execute();

    expect(prisma.$allTenants.subscription.update).toHaveBeenCalledWith({
      where: { id: 'sub-1' },
      data: {
        status: 'CANCELED',
        canceledAt: NOW,
        cancelAtPeriodEnd: false,
      },
    });
    expect(cache.invalidate).toHaveBeenCalledWith('org-1');
  });
});
