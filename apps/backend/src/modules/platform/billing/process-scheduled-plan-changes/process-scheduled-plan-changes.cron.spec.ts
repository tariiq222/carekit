import { FeatureKey } from '@deqah/shared/constants/feature-keys';
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
    organizationSettings: {
      findFirst: jest.fn().mockResolvedValue(null),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  },
});

const buildCache = () => ({ invalidate: jest.fn() });

const buildSafety = (
  result: { ok: boolean; violations: Array<{ kind: string; current: number; targetMax: number }> } = { ok: true, violations: [] },
) => ({
  checkDowngrade: jest.fn().mockResolvedValue(result),
});

const proPlan = { priceMonthly: '900.00', limits: { maxEmployees: 20 } };
const basicPlan = { priceMonthly: '300.00', limits: { maxEmployees: 5 } };

describe('ProcessScheduledPlanChangesCron', () => {
  beforeEach(() => jest.useFakeTimers().setSystemTime(NOW));
  afterEach(() => jest.useRealTimers());

  it('does nothing when billing cron is disabled', async () => {
    const prisma = buildPrisma([{ id: 'sub-1' }]);
    const cron = new ProcessScheduledPlanChangesCron(
      prisma as never,
      buildConfig(false) as never,
      buildCache() as never,
      buildSafety() as never,
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
      buildSafety() as never,
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
        plan: { select: { priceMonthly: true, limits: true } },
        scheduledPlan: { select: { priceMonthly: true, limits: true } },
      },
    });
  });

  it('applies safe downgrades, clears scheduled fields, and invalidates cache', async () => {
    const prisma = buildPrisma([
      {
        id: 'sub-1',
        organizationId: 'org-1',
        scheduledPlanId: 'plan-basic',
        scheduledBillingCycle: 'MONTHLY',
        plan: proPlan,
        scheduledPlan: basicPlan,
      },
    ]);
    const cache = buildCache();
    const safety = buildSafety({ ok: true, violations: [] });
    const cron = new ProcessScheduledPlanChangesCron(
      prisma as never,
      buildConfig(true) as never,
      cache as never,
      safety as never,
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
        scheduledChangeBlockedReason: null,
      },
    });
    expect(cache.invalidate).toHaveBeenCalledWith('org-1');
  });

  it('blocks the cron-time swap if usage grew between schedule and period-end + sets scheduledChangeBlockedReason', async () => {
    const prisma = buildPrisma([
      {
        id: 'sub-1',
        organizationId: 'org-1',
        scheduledPlanId: 'plan-basic',
        scheduledBillingCycle: 'MONTHLY',
        plan: proPlan,
        scheduledPlan: basicPlan,
      },
    ]);
    const cache = buildCache();
    const safety = buildSafety({
      ok: false,
      violations: [{ kind: FeatureKey.EMPLOYEES, current: 12, targetMax: 5 }],
    });
    const cron = new ProcessScheduledPlanChangesCron(
      prisma as never,
      buildConfig(true) as never,
      cache as never,
      safety as never,
    );

    await cron.execute();

    expect(prisma.$allTenants.subscription.update).toHaveBeenCalledWith({
      where: { id: 'sub-1' },
      data: { scheduledChangeBlockedReason: 'BLOCKED_BY_USAGE' },
    });
    // The block update should be the only update — the actual swap must NOT run.
    const updateCalls = prisma.$allTenants.subscription.update.mock.calls;
    expect(updateCalls).toHaveLength(1);
    expect(cache.invalidate).toHaveBeenCalledWith('org-1');
  });

  it('does not run safety check on upgrades (target price >= current)', async () => {
    const prisma = buildPrisma([
      {
        id: 'sub-1',
        organizationId: 'org-1',
        scheduledPlanId: 'plan-pro',
        scheduledBillingCycle: 'MONTHLY',
        plan: basicPlan,
        scheduledPlan: proPlan,
      },
    ]);
    const safety = buildSafety();
    const cron = new ProcessScheduledPlanChangesCron(
      prisma as never,
      buildConfig(true) as never,
      buildCache() as never,
      safety as never,
    );

    await cron.execute();

    expect(safety.checkDowngrade).not.toHaveBeenCalled();
    expect(prisma.$allTenants.subscription.update).toHaveBeenCalledWith({
      where: { id: 'sub-1' },
      data: expect.objectContaining({ planId: 'plan-pro' }),
    });
  });

  it('writes grace columns for api_access and webhooks on downgrade swap', async () => {
    const prisma = buildPrisma([
      {
        id: 'sub-1',
        organizationId: 'org-1',
        scheduledPlanId: 'plan-basic',
        scheduledBillingCycle: 'MONTHLY',
        plan: { priceMonthly: '900.00', limits: { api_access: true, webhooks: true } },
        scheduledPlan: { priceMonthly: '300.00', limits: { api_access: false, webhooks: false } },
      },
    ]);
    const cron = new ProcessScheduledPlanChangesCron(
      prisma as never,
      buildConfig(true) as never,
      buildCache() as never,
      buildSafety() as never,
    );

    await cron.execute();

    const updateCalls = (prisma.$allTenants.subscription.update as jest.Mock).mock.calls;
    const graceCalls = updateCalls.filter(
      ([call]) => call.data.apiAccessGraceUntil || call.data.webhooksGraceUntil,
    );
    expect(graceCalls.length).toBe(1);
    expect(graceCalls[0][0].data.apiAccessGraceUntil).toBeInstanceOf(Date);
    expect(graceCalls[0][0].data.webhooksGraceUntil).toBeInstanceOf(Date);
  });

  it('writes customDomainGraceUntil on downgrade swap when org has a custom domain', async () => {
    const prisma = buildPrisma([
      {
        id: 'sub-1',
        organizationId: 'org-1',
        scheduledPlanId: 'plan-basic',
        scheduledBillingCycle: 'MONTHLY',
        plan: { priceMonthly: '900.00', limits: { custom_domain: true } },
        scheduledPlan: { priceMonthly: '300.00', limits: { custom_domain: false } },
      },
    ]);
    prisma.$allTenants.organizationSettings.findFirst.mockResolvedValue({ customDomain: 'custom.example.com' });
    const cron = new ProcessScheduledPlanChangesCron(
      prisma as never,
      buildConfig(true) as never,
      buildCache() as never,
      buildSafety() as never,
    );

    await cron.execute();

    expect(prisma.$allTenants.organizationSettings.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ customDomainGraceUntil: expect.any(Date) }),
      }),
    );
  });

  it('does NOT write grace columns for upgrades', async () => {
    const prisma = buildPrisma([
      {
        id: 'sub-1',
        organizationId: 'org-1',
        scheduledPlanId: 'plan-pro',
        scheduledBillingCycle: 'MONTHLY',
        plan: { priceMonthly: '300.00', limits: { api_access: false } },
        scheduledPlan: { priceMonthly: '900.00', limits: { api_access: true } },
      },
    ]);
    const cron = new ProcessScheduledPlanChangesCron(
      prisma as never,
      buildConfig(true) as never,
      buildCache() as never,
      buildSafety() as never,
    );

    await cron.execute();

    const updateCalls = (prisma.$allTenants.subscription.update as jest.Mock).mock.calls;
    const graceCalls = updateCalls.filter(
      ([call]) => call.data.apiAccessGraceUntil || call.data.webhooksGraceUntil,
    );
    expect(graceCalls.length).toBe(0);
  });
});
