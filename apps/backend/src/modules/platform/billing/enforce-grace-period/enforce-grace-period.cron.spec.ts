import { EnforceGracePeriodCron } from './enforce-grace-period.cron';
import { SubscriptionStateMachine } from '../subscription-state-machine';

const buildConfig = (enabled: boolean, graceDays = 2) => ({
  get: jest.fn().mockImplementation((key: string, def: unknown) => {
    if (key === 'BILLING_CRON_ENABLED') return enabled;
    if (key === 'SAAS_GRACE_PERIOD_DAYS') return graceDays;
    return def;
  }),
});

const buildPrisma = (subs: unknown[] = []) => ({
  subscription: {
    findMany: jest.fn().mockResolvedValue(subs),
    update: jest.fn().mockResolvedValue({}),
  },
  refreshToken: {
    updateMany: jest.fn().mockResolvedValue({ count: 1 }),
  },
  clientRefreshToken: {
    updateMany: jest.fn().mockResolvedValue({ count: 0 }),
  },
});

const buildCache = () => ({
  invalidate: jest.fn(),
});

const NOW = new Date('2026-04-22T12:00:00.000Z');
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 24 * 60 * 60 * 1000);

const buildSub = (id: string, pastDueSince: Date) => ({
  id,
  organizationId: `org-${id}`,
  status: 'PAST_DUE' as const,
  pastDueSince,
});

describe('EnforceGracePeriodCron', () => {
  beforeEach(() => jest.useFakeTimers().setSystemTime(NOW));
  afterEach(() => jest.useRealTimers());

  it('does nothing when BILLING_CRON_ENABLED=false', async () => {
    const prisma = buildPrisma([buildSub('s1', daysAgo(3))]);
    const cron = new EnforceGracePeriodCron(
      prisma as never,
      buildConfig(false) as never,
      new SubscriptionStateMachine(),
      buildCache() as never,
    );
    await cron.execute();
    expect(prisma.subscription.findMany).not.toHaveBeenCalled();
    expect(prisma.subscription.update).not.toHaveBeenCalled();
  });

  it('does nothing for PAST_DUE subs within grace window (pastDueSince = now - 1 day, grace=2)', async () => {
    // The WHERE clause already filters on pastDueSince lte (now - grace), so findMany returns empty
    const prisma = buildPrisma([]);
    const cron = new EnforceGracePeriodCron(
      prisma as never,
      buildConfig(true, 2) as never,
      new SubscriptionStateMachine(),
      buildCache() as never,
    );
    await cron.execute();
    expect(prisma.subscription.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'PAST_DUE',
          pastDueSince: expect.objectContaining({ lte: expect.any(Date) }),
        }),
      }),
    );
    expect(prisma.subscription.update).not.toHaveBeenCalled();
  });

  it('suspends PAST_DUE sub after grace expires (pastDueSince = now - 3 days, grace=2)', async () => {
    const sub = buildSub('s2', daysAgo(3));
    const prisma = buildPrisma([sub]);
    const cache = buildCache();
    const cron = new EnforceGracePeriodCron(
      prisma as never,
      buildConfig(true, 2) as never,
      new SubscriptionStateMachine(),
      cache as never,
    );
    await cron.execute();

    expect(prisma.subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 's2' },
        data: expect.objectContaining({ status: 'SUSPENDED' }),
      }),
    );
    expect(cache.invalidate).toHaveBeenCalledWith('org-s2');
  });

  it('revokes refreshToken rows on suspend', async () => {
    const sub = buildSub('s3', daysAgo(3));
    const prisma = buildPrisma([sub]);
    const cron = new EnforceGracePeriodCron(
      prisma as never,
      buildConfig(true, 2) as never,
      new SubscriptionStateMachine(),
      buildCache() as never,
    );
    await cron.execute();

    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: 'org-s3' },
        data: expect.objectContaining({ revokedAt: expect.any(Date) }),
      }),
    );
  });

  it('respects SAAS_GRACE_PERIOD_DAYS env override (grace=7 → sub not suspended at day 3)', async () => {
    // With grace=7, pastDueSince must be lte (now - 7 days). Sub is only 3 days past due,
    // so the DB WHERE would NOT return it — prisma.findMany returns empty
    const prisma = buildPrisma([]);
    const cron = new EnforceGracePeriodCron(
      prisma as never,
      buildConfig(true, 7) as never,
      new SubscriptionStateMachine(),
      buildCache() as never,
    );
    await cron.execute();

    // Verify the cutoff date passed to findMany reflects the 7-day grace
    const findManyCall = prisma.subscription.findMany.mock.calls[0][0] as {
      where: { pastDueSince: { lte: Date } };
    };
    const cutoff = findManyCall.where.pastDueSince.lte;
    const expectedCutoff = new Date(NOW.getTime() - 7 * 24 * 60 * 60 * 1000);
    expect(cutoff.getTime()).toBeCloseTo(expectedCutoff.getTime(), -2); // within 100ms
    expect(prisma.subscription.update).not.toHaveBeenCalled();
  });

  it('does not touch ACTIVE/TRIALING/CANCELED subs (only PAST_DUE is queried)', async () => {
    // findMany WHERE status: 'PAST_DUE' ensures only PAST_DUE rows are considered
    const prisma = buildPrisma([]);
    const cron = new EnforceGracePeriodCron(
      prisma as never,
      buildConfig(true, 2) as never,
      new SubscriptionStateMachine(),
      buildCache() as never,
    );
    await cron.execute();

    expect(prisma.subscription.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'PAST_DUE' }),
      }),
    );
    expect(prisma.subscription.update).not.toHaveBeenCalled();
  });
});
