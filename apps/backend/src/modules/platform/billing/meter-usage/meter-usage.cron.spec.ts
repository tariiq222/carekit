import { MeterUsageCron } from './meter-usage.cron';
import { UsageAggregatorService } from '../usage-aggregator.service';

const buildConfig = (enabled: boolean) => ({
  get: jest.fn().mockReturnValue(enabled),
});

const buildAggregator = (rows: Array<{ organizationId: string; metric: string; count: number }> = []) => ({
  flush: jest.fn().mockReturnValue(rows),
});

const buildPrisma = (sub: unknown = null) => ({
  subscription: {
    findFirst: jest.fn().mockResolvedValue(sub),
  },
  usageRecord: {
    upsert: jest.fn().mockResolvedValue({}),
  },
});

describe('MeterUsageCron', () => {
  it('does nothing when BILLING_CRON_ENABLED=false', async () => {
    const prisma = buildPrisma();
    const aggregator = buildAggregator([{ organizationId: 'org-1', metric: 'BOOKINGS_PER_MONTH', count: 10 }]);
    const cron = new MeterUsageCron(prisma as never, buildConfig(false) as never, aggregator as never);
    await cron.execute();
    expect(aggregator.flush).not.toHaveBeenCalled();
    expect(prisma.usageRecord.upsert).not.toHaveBeenCalled();
  });

  it('does nothing when aggregator is empty', async () => {
    const prisma = buildPrisma();
    const aggregator = buildAggregator([]);
    const cron = new MeterUsageCron(prisma as never, buildConfig(true) as never, aggregator as never);
    await cron.execute();
    expect(prisma.usageRecord.upsert).not.toHaveBeenCalled();
  });

  it('upserts UsageRecord for each metric per org', async () => {
    const sub = {
      id: 'sub-1',
      organizationId: 'org-1',
      currentPeriodStart: new Date('2026-04-01'),
      currentPeriodEnd: new Date('2026-04-30'),
    };
    const prisma = buildPrisma(sub);
    const aggregator = buildAggregator([
      { organizationId: 'org-1', metric: 'BOOKINGS_PER_MONTH', count: 50 },
      { organizationId: 'org-1', metric: 'CLIENTS', count: 5 },
    ]);
    const cron = new MeterUsageCron(prisma as never, buildConfig(true) as never, aggregator as never);
    await cron.execute();
    expect(prisma.usageRecord.upsert).toHaveBeenCalledTimes(2);
    expect(prisma.usageRecord.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          subscriptionId_metric_periodStart: expect.objectContaining({
            subscriptionId: 'sub-1',
            metric: 'BOOKINGS_PER_MONTH',
            periodStart: sub.currentPeriodStart,
          }),
        }),
        update: { count: { increment: 50 } },
        create: expect.objectContaining({
          organizationId: 'org-1',
          subscriptionId: 'sub-1',
          metric: 'BOOKINGS_PER_MONTH',
          count: 50,
        }),
      }),
    );
  });

  it('skips orgs with no active subscription', async () => {
    const prisma = buildPrisma(null);
    const aggregator = buildAggregator([
      { organizationId: 'org-no-sub', metric: 'BOOKINGS_PER_MONTH', count: 10 },
    ]);
    const cron = new MeterUsageCron(prisma as never, buildConfig(true) as never, aggregator as never);
    await cron.execute();
    expect(prisma.subscription.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: 'org-no-sub',
          status: { in: ['TRIALING', 'ACTIVE', 'PAST_DUE'] },
        }),
      }),
    );
    expect(prisma.usageRecord.upsert).not.toHaveBeenCalled();
  });
});

// Re-export for cron-tasks registration
describe('UsageAggregatorService (used by MeterUsageCron)', () => {
  it('flush returns all incremented counters and clears them', () => {
    const agg = new UsageAggregatorService();
    agg.increment('org-1', 'BOOKINGS_PER_MONTH', 3);
    agg.increment('org-1', 'BOOKINGS_PER_MONTH', 2);
    const flushed = agg.flush();
    expect(flushed).toEqual([{ organizationId: 'org-1', metric: 'BOOKINGS_PER_MONTH', count: 5 }]);
    expect(agg.flush()).toEqual([]);
  });
});
