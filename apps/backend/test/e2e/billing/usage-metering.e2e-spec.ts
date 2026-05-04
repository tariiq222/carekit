import { ConfigService } from '@nestjs/config';
import { bootHarness, IsolationHarness } from '../../tenant-isolation/isolation-harness';
import { MeterUsageCron } from '../../../src/modules/platform/billing/meter-usage/meter-usage.cron';
import { UsageAggregatorService } from '../../../src/modules/platform/billing/usage-aggregator.service';

/**
 * SaaS-04 Task 14C — meter-usage cron e2e.
 *
 * Verifies:
 * 1. Aggregator counters flush into UsageRecord rows per org/metric/period.
 * 2. Cross-tenant isolation — Org A's counters never leak into Org B's records.
 * 3. Re-running the cron upserts (increments) instead of duplicating rows.
 * 4. Orgs without an ACTIVE/TRIALING/PAST_DUE subscription are skipped.
 */
describe('SaaS-04 — usage metering cron', () => {
  let h: IsolationHarness;

  let BASIC_PLAN_ID: string;
  let ENTERPRISE_PLAN_ID: string;

  beforeAll(async () => {
    process.env.MOYASAR_PLATFORM_SECRET_KEY ??= 'test-platform-secret-key';
    process.env.MOYASAR_PLATFORM_WEBHOOK_SECRET ??= 'test-platform-webhook-secret';
    process.env.BILLING_CRON_ENABLED = 'true';
    h = await bootHarness();
    (h.app.get(ConfigService) as ConfigService & { set: (k: string, v: unknown) => void })
      .set('BILLING_CRON_ENABLED', true);
    const plans = await h.prisma.plan.findMany({ where: { slug: { in: ['BASIC', 'ENTERPRISE'] } } });
    BASIC_PLAN_ID = plans.find((p) => p.slug === 'BASIC')!.id;
    ENTERPRISE_PLAN_ID = plans.find((p) => p.slug === 'ENTERPRISE')!.id;
  });

  afterAll(async () => {
    if (h) await h.close();
  });

  async function seedSubscription(
    organizationId: string,
    planId: string,
    status: 'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED' = 'ACTIVE',
  ): Promise<{ id: string; currentPeriodStart: Date; currentPeriodEnd: Date }> {
    const now = new Date();
    const periodStart = new Date('2031-06-01T00:00:00Z');
    const periodEnd = new Date('2031-07-01T00:00:00Z');
    const row = await h.prisma.subscription.create({
      data: {
        organizationId,
        planId,
        status,
        billingCycle: 'MONTHLY',
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
      },
      select: { id: true, currentPeriodStart: true, currentPeriodEnd: true },
    });
    return row;
  }

  it('flushes aggregated counters into UsageRecord rows, scoped per org', async () => {
    const ts = Date.now();
    const orgA = await h.createOrg(`meter-a-${ts}`, 'منظمة عداد أ');
    const orgB = await h.createOrg(`meter-b-${ts}`, 'منظمة عداد ب');

    const subA = await seedSubscription(orgA.id, BASIC_PLAN_ID);
    const subB = await seedSubscription(orgB.id, ENTERPRISE_PLAN_ID);

    const aggregator = h.app.get(UsageAggregatorService);
    const cron = h.app.get(MeterUsageCron);

    aggregator.increment(orgA.id, 'BOOKINGS_PER_MONTH', 3);
    aggregator.increment(orgA.id, 'CLIENTS', 5);
    aggregator.increment(orgB.id, 'BOOKINGS_PER_MONTH', 8);
    aggregator.increment(orgB.id, 'CLIENTS', 15);

    await cron.execute();

    // Org A — expect 2 records
    const recordsA = await h.prisma.usageRecord.findMany({
      where: { subscriptionId: subA.id },
      orderBy: { metric: 'asc' },
    });
    expect(recordsA).toHaveLength(2);
    expect(recordsA.map((r) => [r.metric, r.count])).toEqual([
      ['BOOKINGS_PER_MONTH', 3],
      ['CLIENTS', 5],
    ]);
    expect(recordsA.every((r) => r.organizationId === orgA.id)).toBe(true);
    expect(recordsA.every((r) => r.periodStart.getTime() === subA.currentPeriodStart.getTime())).toBe(true);

    // Org B — expect 2 records, different counts
    const recordsB = await h.prisma.usageRecord.findMany({
      where: { subscriptionId: subB.id },
      orderBy: { metric: 'asc' },
    });
    expect(recordsB).toHaveLength(2);
    expect(recordsB.map((r) => [r.metric, r.count])).toEqual([
      ['BOOKINGS_PER_MONTH', 8],
      ['CLIENTS', 15],
    ]);
    expect(recordsB.every((r) => r.organizationId === orgB.id)).toBe(true);

    // Isolation: under CLS of Org A, queries must not see Org B's rows
    let visibleFromA: number;
    await h.runAs({ organizationId: orgA.id }, async () => {
      visibleFromA = await h.prisma.usageRecord.count({
        where: { subscriptionId: { in: [subA.id, subB.id] } },
      });
    });
    expect(visibleFromA!).toBe(2);

    let visibleFromB: number;
    await h.runAs({ organizationId: orgB.id }, async () => {
      visibleFromB = await h.prisma.usageRecord.count({
        where: { subscriptionId: { in: [subA.id, subB.id] } },
      });
    });
    expect(visibleFromB!).toBe(2);
  });

  it('re-running cron with new counters upserts (increments) instead of duplicating', async () => {
    const ts = Date.now();
    const org = await h.createOrg(`meter-upsert-${ts}`, 'منظمة دمج');
    const sub = await seedSubscription(org.id, BASIC_PLAN_ID);

    const aggregator = h.app.get(UsageAggregatorService);
    const cron = h.app.get(MeterUsageCron);

    aggregator.increment(org.id, 'BOOKINGS_PER_MONTH', 4);
    await cron.execute();

    aggregator.increment(org.id, 'BOOKINGS_PER_MONTH', 7);
    await cron.execute();

    const records = await h.prisma.usageRecord.findMany({
      where: { subscriptionId: sub.id, metric: 'BOOKINGS_PER_MONTH' },
    });
    expect(records).toHaveLength(1);
    expect(records[0].count).toBe(11);
  });

  it('skips orgs without an active subscription', async () => {
    const ts = Date.now();
    const org = await h.createOrg(`meter-nosub-${ts}`, 'منظمة بلا اشتراك');
    // no subscription seeded

    const aggregator = h.app.get(UsageAggregatorService);
    const cron = h.app.get(MeterUsageCron);
    aggregator.increment(org.id, 'BOOKINGS_PER_MONTH', 5);
    await cron.execute();

    const records = await h.prisma.usageRecord.findMany({ where: { organizationId: org.id } });
    expect(records).toHaveLength(0);
  });

  it('skips CANCELED subscriptions', async () => {
    const ts = Date.now();
    const org = await h.createOrg(`meter-canceled-${ts}`, 'منظمة ملغاة');
    const sub = await seedSubscription(org.id, BASIC_PLAN_ID, 'CANCELED');

    const aggregator = h.app.get(UsageAggregatorService);
    const cron = h.app.get(MeterUsageCron);
    aggregator.increment(org.id, 'BOOKINGS_PER_MONTH', 5);
    await cron.execute();

    const records = await h.prisma.usageRecord.findMany({ where: { subscriptionId: sub.id } });
    expect(records).toHaveLength(0);
  });
});
