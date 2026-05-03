import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { bootHarness, IsolationHarness } from '../../tenant-isolation/isolation-harness';
import { FeatureGuard } from '../../../src/modules/platform/billing/feature.guard';
import { SubscriptionCacheService } from '../../../src/modules/platform/billing/subscription-cache.service';
import { REQUIRE_FEATURE_KEY } from '../../../src/modules/platform/billing/feature.decorator';
import { FeatureNotEnabledException } from '../../../src/modules/platform/billing/feature-not-enabled.exception';
import { FeatureKey } from '@deqah/shared/constants/feature-keys';
import { UsageCounterService } from '../../../src/modules/platform/billing/usage-counter/usage-counter.service';

/**
 * UI-only feature keys — no backend @RequireFeature guard exists for these.
 *
 * Documented "UI-only" in feature-key-map.ts:
 *   white_label_mobile, custom_domain, api_access, webhooks, priority_support,
 *   audit_export, multi_currency, walk_in_bookings, data_export
 *
 * This suite locks in the current enforcement state:
 *  - UI-only keys pass the FeatureGuard (guard cannot block what has no @RequireFeature metadata).
 *  - Backend-enforced keys (ADVANCED_REPORTS, ACTIVITY_LOG) DO block on BASIC.
 *
 * If a UI-only key gains a backend surface, it MUST be paired with @RequireFeature —
 * and a test in feature-enforcement.e2e-spec.ts must be added. The passing test here
 * would then need to be removed (or converted to an expectGated test).
 */
describe('UI-only feature keys — guard pass-through vs enforced keys on BASIC', () => {
  let h: IsolationHarness;
  let guard: FeatureGuard;
  let org: { id: string };
  let BASIC_PLAN_ID: string;

  beforeAll(async () => {
    process.env.MOYASAR_PLATFORM_SECRET_KEY ??= 'test-platform-secret-key';
    process.env.MOYASAR_PLATFORM_WEBHOOK_SECRET ??= 'test-platform-webhook-secret';

    h = await bootHarness();

    const basicPlan = await h.prisma.plan.findFirst({ where: { slug: 'BASIC' } });
    if (!basicPlan) throw new Error('BASIC plan not found — run migrations + seed first');
    BASIC_PLAN_ID = basicPlan.id;

    const ts = Date.now();
    org = await h.createOrg(`ui-only-keys-${ts}`, 'منظمة اختبار المفاتيح الواجهة');

    const now = new Date();
    await h.prisma.subscription.create({
      data: {
        organizationId: org.id,
        planId: BASIC_PLAN_ID,
        status: 'ACTIVE',
        billingCycle: 'MONTHLY',
        currentPeriodStart: now,
        currentPeriodEnd: new Date(now.getTime() + 30 * 86_400_000),
      },
    });

    guard = new FeatureGuard(
      h.app.get(Reflector),
      h.prisma,
      h.app.get(SubscriptionCacheService),
      h.app.get(UsageCounterService),
    );

    h.app.get(SubscriptionCacheService).invalidate(org.id);
  });

  afterAll(async () => {
    if (h) {
      await h.cleanupOrg(org.id);
      await h.close();
    }
  });

  function ctxFor(featureKey: FeatureKey, organizationId: string): ExecutionContext {
    const handler = function () {};
    Reflect.defineMetadata(REQUIRE_FEATURE_KEY, featureKey, handler);
    return {
      getHandler: () => handler,
      getClass: () => class {},
      switchToHttp: () => ({ getRequest: () => ({ user: { organizationId } }) }),
    } as unknown as ExecutionContext;
  }

  it('WALK_IN_BOOKINGS passes FeatureGuard on BASIC (UI-only: no backend surface yet)', async () => {
    await h.runAs({ organizationId: org.id }, async () => {
      const result = await guard.canActivate(ctxFor(FeatureKey.WALK_IN_BOOKINGS, org.id));
      expect(result).toBe(true);
    });
  });

  it('DATA_EXPORT passes FeatureGuard on BASIC (UI-only: no backend surface yet)', async () => {
    await h.runAs({ organizationId: org.id }, async () => {
      const result = await guard.canActivate(ctxFor(FeatureKey.DATA_EXPORT, org.id));
      expect(result).toBe(true);
    });
  });

  it('ADVANCED_REPORTS is enforced on BASIC (ops.controller POST /reports is @RequireFeature gated)', async () => {
    await h.runAs({ organizationId: org.id }, async () => {
      await expect(guard.canActivate(ctxFor(FeatureKey.ADVANCED_REPORTS, org.id))).rejects.toBeInstanceOf(
        FeatureNotEnabledException,
      );
    });
  });

  it('ACTIVITY_LOG is enforced on BASIC (ops.controller GET /activity-log is @RequireFeature gated)', async () => {
    await h.runAs({ organizationId: org.id }, async () => {
      await expect(guard.canActivate(ctxFor(FeatureKey.ACTIVITY_LOG, org.id))).rejects.toBeInstanceOf(
        FeatureNotEnabledException,
      );
    });
  });
});
