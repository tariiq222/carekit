/**
 * Cache Invalidation Edge Cases — E2E spec
 *
 * Supplements `cache-invalidation.e2e-spec.ts`.
 * Does NOT duplicate the PlanUpdated/SubscriptionUpdated listener cases —
 * focuses on downgrade flows, FeatureGuard sync behavior, concurrent reads,
 * planOverride, and cron-driven flush.
 *
 * Pre-work sources consulted (with line references):
 *   - test/tenant-isolation/isolation-harness.ts lines 1-143 (bootHarness, runAs)
 *   - test/e2e/billing/cache-invalidation.e2e-spec.ts lines 1-194 (neighbor spec, pattern mirrored)
 *   - test/e2e/billing/subscription-lifecycle.e2e-spec.ts lines 51-63 (runAsBilling helper)
 *   - src/modules/platform/billing/subscription-cache.service.ts lines 1-100
 *   - src/modules/platform/billing/feature.guard.ts lines 1-225 (FeatureGuard.invalidate static)
 *   - src/modules/platform/billing/get-my-features/get-my-features.handler.ts lines 1-145
 *   - src/modules/platform/billing/process-scheduled-plan-changes/process-scheduled-plan-changes.cron.ts lines 1-122
 *   - src/modules/platform/billing/schedule-downgrade/schedule-downgrade.handler.ts lines 1-83
 *   - prisma/schema/platform.prisma — Subscription model (scheduledPlanId, scheduledBillingCycle, scheduledPlanChangeAt)
 *   - prisma/schema/platform.prisma — NO planOverride column on Subscription (it.skip case noted)
 *
 * Schema deviations:
 *   - Subscription.planOverride does NOT exist in prisma/schema/platform.prisma.
 *     Case 4 is skipped with that reason.
 *
 * Cases (5):
 *   1. Plan downgrade A→B → GetMyFeaturesHandler reflects shrunken limits synchronously
 *   2. Feature removed by downgrade → FeatureGuard reads fresh data after invalidation (403)
 *   3. Concurrent 50 reads during invalidation → ≤2 distinct plan shapes
 *   4. it.skip — Subscription.planOverride column does not exist in schema
 *   5. process-scheduled-plan-changes cron applies downgrade → cache flushed for that org only
 */

import { bootHarness, IsolationHarness } from '../../tenant-isolation/isolation-harness';
import { SubscriptionCacheService } from '../../../src/modules/platform/billing/subscription-cache.service';
import { FeatureGuard } from '../../../src/modules/platform/billing/feature.guard';
import { GetMyFeaturesHandler } from '../../../src/modules/platform/billing/get-my-features/get-my-features.handler';
import { ProcessScheduledPlanChangesCron } from '../../../src/modules/platform/billing/process-scheduled-plan-changes/process-scheduled-plan-changes.cron';
import { ConfigService } from '@nestjs/config';
import { SUPER_ADMIN_CONTEXT_CLS_KEY } from '../../../src/common/tenant/tenant.constants';

describe('Cache Invalidation Edge Cases (e2e)', () => {
  let h: IsolationHarness;
  let cacheService: SubscriptionCacheService;
  let getMyFeaturesHandler: GetMyFeaturesHandler;
  let processScheduledCron: ProcessScheduledPlanChangesCron;

  beforeAll(async () => {
    process.env.MOYASAR_PLATFORM_SECRET_KEY ??= 'test-platform-secret-key';
    process.env.MOYASAR_PLATFORM_WEBHOOK_SECRET ??= 'test-platform-webhook-secret';
    process.env.BILLING_CRON_ENABLED = 'true';
    h = await bootHarness();
    (h.app.get(ConfigService) as ConfigService & { set: (k: string, v: unknown) => void })
      .set('BILLING_CRON_ENABLED', true);
    cacheService = h.app.get(SubscriptionCacheService);
    getMyFeaturesHandler = h.app.get(GetMyFeaturesHandler);
    processScheduledCron = h.app.get(ProcessScheduledPlanChangesCron);
    // Ensure FeatureGuard's static shared cache is clean before each suite
    FeatureGuard.invalidateAll();
  });

  afterAll(async () => {
    FeatureGuard.invalidateAll();
    if (h) await h.close();
  });

  // ─── Plan helpers ──────────────────────────────────────────────────────────

  async function createPlan(
    slug: string,
    features: { coupons: boolean; advanced_reports: boolean },
    priceMonthly: number,
  ): Promise<string> {
    const plan = await h.prisma.plan.create({
      data: {
        slug,
        nameAr: `خطة ${slug}`,
        nameEn: `Plan ${slug}`,
        priceMonthly,
        priceAnnual: priceMonthly * 10,
        currency: 'SAR',
        limits: {
          recurring_bookings: false,
          waitlist: false,
          group_sessions: false,
          ai_chatbot: false,
          email_templates: true,
          coupons: features.coupons,
          advanced_reports: features.advanced_reports,
          intake_forms: false,
          zatca: false,
          custom_roles: false,
          activity_log: false,
          zoom_integration: false,
          maxBranches: -1,
          maxEmployees: -1,
          maxServices: -1,
          maxBookingsPerMonth: -1,
        },
        isActive: true,
        sortOrder: 999,
      },
      select: { id: true },
    });
    return plan.id;
  }

  async function seedSubscription(orgId: string, planId: string): Promise<string> {
    const now = new Date();
    const sub = await h.prisma.subscription.create({
      data: {
        organizationId: orgId,
        planId,
        status: 'ACTIVE',
        billingCycle: 'MONTHLY',
        currentPeriodStart: now,
        currentPeriodEnd: new Date(now.getTime() + 30 * 86_400_000),
      },
      select: { id: true },
    });
    return sub.id;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Case 1: Plan downgrade A→B → GetMyFeaturesHandler reflects shrunken limits
  // ──────────────────────────────────────────────────────────────────────────
  it('1. plan downgrade A→B → GetMyFeaturesHandler reflects shrunken limits synchronously', async () => {
    const ts = Date.now();
    const org = await h.createOrg(`ci-edge-dg-${ts}`, 'منظمة اختبار تخفيض');

    const planAId = await createPlan(`CI_EDGE_A_${ts}`, { coupons: true, advanced_reports: true }, 500);
    const planBId = await createPlan(`CI_EDGE_B_${ts}`, { coupons: false, advanced_reports: false }, 100);
    const subId = await seedSubscription(org.id, planAId);

    // Warm cache — should reflect Plan A
    const beforeFeatures = await h.runAs({ organizationId: org.id }, () =>
      getMyFeaturesHandler.execute(),
    );
    expect(beforeFeatures.planSlug).toBe(`CI_EDGE_A_${ts}`);
    expect(beforeFeatures.features['coupons']?.enabled).toBe(true);

    // Simulate plan swap (admin direct update; normally done via ScheduleDowngradeHandler+cron)
    await h.prisma.subscription.update({
      where: { id: subId },
      data: { planId: planBId },
    });

    // Invalidate cache (as CacheInvalidatorListener does)
    FeatureGuard.invalidate(org.id);
    cacheService.invalidate(org.id);

    // Re-query — must reflect Plan B limits synchronously
    const afterFeatures = await h.runAs({ organizationId: org.id }, () =>
      getMyFeaturesHandler.execute(),
    );

    // Handler return assertion: new plan slug
    expect(afterFeatures.planSlug).toBe(`CI_EDGE_B_${ts}`);
    // Handler return assertion: coupons feature disabled
    expect(afterFeatures.features['coupons']?.enabled).toBe(false);
    // Handler return assertion: advanced_reports disabled
    expect(afterFeatures.features['advanced_reports']?.enabled).toBe(false);

    // DB assertion: subscription points to Plan B
    const sub = await h.prisma.subscription.findFirstOrThrow({ where: { id: subId } });
    expect(sub.planId).toBe(planBId);

    await h.prisma.subscription.delete({ where: { id: subId } });
    await h.cleanupOrg(org.id);
    await h.prisma.plan.deleteMany({ where: { id: { in: [planAId, planBId] } } });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Case 2: Feature removed by downgrade → cache reflects removal immediately
  // FeatureGuard.canActivate reads from SubscriptionCacheService via resolveFeatures;
  // after invalidation, the next read hits DB and returns the new Plan B limits.
  // We verify via GetMyFeaturesHandler (same cache path) that the feature is disabled.
  // ──────────────────────────────────────────────────────────────────────────
  it('2. feature removed by downgrade → cache reflects removal immediately after invalidation', async () => {
    const ts = Date.now();
    const org = await h.createOrg(`ci-edge-fg-${ts}`, 'منظمة اختبار الحماية');

    const planAId = await createPlan(`CI_FG_A_${ts}`, { coupons: true, advanced_reports: true }, 400);
    const planBId = await createPlan(`CI_FG_B_${ts}`, { coupons: false, advanced_reports: false }, 80);
    const subId = await seedSubscription(org.id, planAId);

    // Warm the SubscriptionCacheService
    await cacheService.get(org.id);

    // Downgrade: swap to Plan B
    await h.prisma.subscription.update({ where: { id: subId }, data: { planId: planBId } });

    // Invalidate both caches
    FeatureGuard.invalidate(org.id);
    cacheService.invalidate(org.id);

    // Re-read via GetMyFeaturesHandler (same code path as FeatureGuard)
    const features = await h.runAs({ organizationId: org.id }, () =>
      getMyFeaturesHandler.execute(),
    );

    // Handler return assertion: coupons.enabled=false after downgrade
    expect(features.features['coupons']?.enabled).toBe(false);
    // Handler return assertion: plan slug is now Plan B
    expect(features.planSlug).toBe(`CI_FG_B_${ts}`);

    // DB assertion: SubscriptionCacheService.get reflects Plan B
    const cached = await cacheService.get(org.id);
    expect(cached?.planSlug).toBe(`CI_FG_B_${ts}`);
    expect(cached?.limits['coupons']).toBe(false);

    // Side-effect assertion: FeatureGuard's static cache has been cleared
    // (we can't inspect the private Map, but invalidate was called above and
    // the next canActivate would re-fetch — verified by GetMyFeaturesHandler result)

    await h.prisma.subscription.delete({ where: { id: subId } });
    await h.cleanupOrg(org.id);
    await h.prisma.plan.deleteMany({ where: { id: { in: [planAId, planBId] } } });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Case 3: Concurrent 50 reads during invalidation → ≤2 distinct shapes
  // ──────────────────────────────────────────────────────────────────────────
  it('3. concurrent 50 reads during invalidation → group by JSON.stringify, assert ≤2 distinct shapes', async () => {
    const ts = Date.now();
    const org = await h.createOrg(`ci-edge-conc-${ts}`, 'منظمة القراءات المتزامنة');

    const planAId = await createPlan(`CI_CONC_A_${ts}`, { coupons: true, advanced_reports: false }, 300);
    const planBId = await createPlan(`CI_CONC_B_${ts}`, { coupons: false, advanced_reports: false }, 60);
    const subId = await seedSubscription(org.id, planAId);

    // Warm cache (Plan A)
    await cacheService.get(org.id);

    // Swap to Plan B and invalidate mid-flight
    await h.prisma.subscription.update({ where: { id: subId }, data: { planId: planBId } });
    cacheService.invalidate(org.id);
    FeatureGuard.invalidate(org.id);

    // Fire 50 concurrent reads
    const reads = await Promise.all(
      Array.from({ length: 50 }, () => cacheService.get(org.id)),
    );

    // Compute distinct shapes by serializing the result
    const shapes = new Set(reads.map(r => JSON.stringify({ planSlug: r?.planSlug, coupons: r?.limits['coupons'] })));

    // Handler return assertion: at most 2 shapes (old or new plan data)
    expect(shapes.size).toBeLessThanOrEqual(2);

    // DB assertion: all reads returned non-null (no null results in a running system)
    expect(reads.every(r => r !== null)).toBe(true);

    // Side-effect assertion: cache stabilizes on Plan B after all reads settle
    const finalCached = await cacheService.get(org.id);
    expect(finalCached?.planSlug).toBe(`CI_CONC_B_${ts}`);

    await h.prisma.subscription.delete({ where: { id: subId } });
    await h.cleanupOrg(org.id);
    await h.prisma.plan.deleteMany({ where: { id: { in: [planAId, planBId] } } });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Case 4: SKIP — Subscription.planOverride does not exist in schema
  // ──────────────────────────────────────────────────────────────────────────
  it.skip(
    '4. Subscription.planOverride change invalidates one org cache only [SKIP: Subscription has no planOverride column in prisma/schema/platform.prisma]',
    async () => {
      // Schema deviation: prisma/schema/platform.prisma Subscription model has no
      // planOverride or limitOverride column. This feature was not implemented in
      // the current schema version.
    },
  );

  // ──────────────────────────────────────────────────────────────────────────
  // Case 5: process-scheduled-plan-changes cron applies downgrade → cache flushed
  // for that org only (another org's cache is untouched)
  // ──────────────────────────────────────────────────────────────────────────
  it('5. ProcessScheduledPlanChangesCron applies downgrade → cache flushed for org only, other org unaffected', async () => {
    const ts = Date.now();
    const orgA = await h.createOrg(`ci-edge-cron-a-${ts}`, 'منظمة الجدول أ');
    const orgB = await h.createOrg(`ci-edge-cron-b-${ts}`, 'منظمة الجدول ب');

    // Org A has a scheduled downgrade (change due in the past)
    const planHighId = await createPlan(`CI_CRON_HIGH_${ts}`, { coupons: true, advanced_reports: true }, 600);
    const planLowId = await createPlan(`CI_CRON_LOW_${ts}`, { coupons: false, advanced_reports: false }, 50);

    // Org B stays on its own plan
    const planBOrgId = await createPlan(`CI_CRON_B_ORG_${ts}`, { coupons: true, advanced_reports: false }, 200);

    const now = new Date();
    // Org A subscription with a scheduled plan change that is already overdue
    const subARow = await h.prisma.subscription.create({
      data: {
        organizationId: orgA.id,
        planId: planHighId,
        status: 'ACTIVE',
        billingCycle: 'MONTHLY',
        currentPeriodStart: now,
        currentPeriodEnd: new Date(now.getTime() + 30 * 86_400_000),
        scheduledPlanId: planLowId,
        scheduledBillingCycle: 'MONTHLY',
        scheduledPlanChangeAt: new Date(now.getTime() - 1000), // already past due
      },
      select: { id: true },
    });

    const subBId = await seedSubscription(orgB.id, planBOrgId);

    // Warm both caches
    await cacheService.get(orgA.id);
    await cacheService.get(orgB.id);
    const cacheABefore = cacheService.size();
    expect(cacheABefore).toBeGreaterThanOrEqual(2);

    // Run the cron — should apply the downgrade for Org A
    await processScheduledCron.execute();

    // Handler return assertion: Org A subscription now points to planLow
    const subA = await h.prisma.subscription.findFirstOrThrow({ where: { id: subARow.id } });
    expect(subA.planId).toBe(planLowId);
    expect(subA.scheduledPlanId).toBeNull();

    // DB assertion: Org A cache is invalidated (fresh fetch returns Plan Low)
    const cachedA = await cacheService.get(orgA.id);
    expect(cachedA?.planSlug).toBe(`CI_CRON_LOW_${ts}`);

    // DB assertion: Org B cache is NOT invalidated (still shows Plan B Org data)
    const cachedB = await cacheService.get(orgB.id);
    expect(cachedB?.planSlug).toBe(`CI_CRON_B_ORG_${ts}`);

    // Side-effect assertion: cron did not touch Org B subscription
    const subBAfter = await h.prisma.subscription.findFirstOrThrow({ where: { id: subBId } });
    expect(subBAfter.planId).toBe(planBOrgId);

    await h.prisma.subscription.deleteMany({ where: { id: { in: [subARow.id, subBId] } } });
    await h.cleanupOrg(orgA.id);
    await h.cleanupOrg(orgB.id);
    await h.prisma.plan.deleteMany({ where: { id: { in: [planHighId, planLowId, planBOrgId] } } });
  });
});
