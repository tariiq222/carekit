import { ProcessScheduledPlanChangesCron } from './process-scheduled-plan-changes.cron';

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

const buildCache = () => ({ invalidate: jest.fn() });

describe('ProcessScheduledPlanChangesCron', () => {
  beforeEach(() => jest.useFakeTimers().setSystemTime(NOW));
  afterEach(() => jest.useRealTimers());

  it('does nothing when billing cron is disabled', async () => {
    const prisma = buildPrisma([{ id: 'sub-1' }]);
    const cron = new ProcessScheduledPlanChangesCron(
      prisma as never,
      buildConfig(false) as never,
      buildCache() as never,
    );

    await cron.execute();

    expect(prisma.$allTenants.subscription.findMany).not.toHaveBeenCalled();
  });

  it('queries due active scheduled plan changes only', async () => {
    const prisma = buildPrisma([]);
    const cron = new ProcessScheduledPlanChangesCron(
      prisma as never,
      buildConfig(true) as never,
      buildCache() as never,
    );

    await cron.execute();

    expect(prisma.$allTenants.subscription.findMany).toHaveBeenCalledWith({
      where: {
        status: { in: ['ACTIVE', 'PAST_DUE'] },
        scheduledPlanId: { not: null },
        scheduledBillingCycle: { not: null },
        scheduledPlanChangeAt: { lte: NOW },
      },
      select: {
        id: true,
        organizationId: true,
        scheduledPlanId: true,
        scheduledBillingCycle: true,
      },
    });
  });

  it('applies due changes, clears scheduled fields, and invalidates cache', async () => {
    const prisma = buildPrisma([
      {
        id: 'sub-1',
        organizationId: 'org-1',
        scheduledPlanId: 'plan-basic',
        scheduledBillingCycle: 'MONTHLY',
      },
    ]);
    const cache = buildCache();
    const cron = new ProcessScheduledPlanChangesCron(
      prisma as never,
      buildConfig(true) as never,
      cache as never,
    );

    await cron.execute();

    expect(prisma.$allTenants.subscription.update).toHaveBeenCalledWith({
      where: { id: 'sub-1' },
      data: {
        planId: 'plan-basic',
        billingCycle: 'MONTHLY',
        scheduledPlanId: null,
        scheduledBillingCycle: null,
        scheduledPlanChangeAt: null,
      },
    });
    expect(cache.invalidate).toHaveBeenCalledWith('org-1');
  });
});
