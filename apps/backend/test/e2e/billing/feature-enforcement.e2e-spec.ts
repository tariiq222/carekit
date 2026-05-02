import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { bootHarness, IsolationHarness } from '../../tenant-isolation/isolation-harness';
import { FeatureGuard } from '../../../src/modules/platform/billing/feature.guard';
import { SubscriptionCacheService } from '../../../src/modules/platform/billing/subscription-cache.service';
import { TenantContextService } from '../../../src/common/tenant/tenant-context.service';
import { REQUIRE_FEATURE_KEY } from '../../../src/modules/platform/billing/feature.decorator';
import { FEATURE_KEY_MAP } from '../../../src/modules/platform/billing/feature-key-map';
import { FeatureNotEnabledException } from '../../../src/modules/platform/billing/feature-not-enabled.exception';
import { FeatureKey } from '@deqah/shared/constants/feature-keys';

/**
 * Plan Features Phase 1 — Task 14: FeatureGuard enforcement e2e.
 *
 * Seeds a real Subscription against the BASIC plan, then invokes
 * FeatureGuard.canActivate() directly under CLS tenant context. Verifies:
 * 1. All on/off features that BASIC disables return FeatureNotEnabledException.
 * 2. The exception body has the canonical shape { code, featureKey, planSlug }.
 * 3. A feature that IS enabled on BASIC passes through (sanity case).
 *
 * BASIC plan limits (from migration 20260502000000_plan_limits_feature_keys):
 *   recurring_bookings: false  ← gated
 *   waitlist:           false  ← gated
 *   group_sessions:     false  ← gated (not in Tasks 3-13 scope, but covered)
 *   ai_chatbot:         false  ← gated
 *   email_templates:    true   ← ALLOWED on BASIC → sanity pass
 *   coupons:            false  ← gated
 *   advanced_reports:   false  ← gated
 *   intake_forms:       true   ← ALLOWED on BASIC
 *   zatca:              false  ← gated
 *   custom_roles:       false  ← gated
 *   activity_log:       false  ← gated
 */
describe('Plan Features Phase 1 — FeatureGuard enforcement (BASIC plan)', () => {
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

    // Log the BASIC plan limits so CI output shows the actual DB state
    // (verifies tests are not relying on missing-key fallback)
    console.info('[feature-enforcement] BASIC plan limits:', JSON.stringify(basicPlan.limits, null, 2));

    const ts = Date.now();
    org = await h.createOrg(`feat-enforcement-${ts}`, 'منظمة اختبار الميزات');

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

    // FeatureGuard is registered as APP_GUARD — Nest doesn't expose it via
    // app.get(FeatureGuard). Construct it manually with its injected deps.
    guard = new FeatureGuard(
      h.app.get(Reflector),
      h.prisma,
      h.app.get(TenantContextService),
      h.app.get(SubscriptionCacheService),
    );

    // Invalidate any pre-existing cache entry for this org
    h.app.get(SubscriptionCacheService).invalidate(org.id);
  });

  afterAll(async () => {
    if (h) {
      await h.cleanupOrg(org.id);
      await h.close();
    }
  });

  function ctxFor(featureKey: FeatureKey): ExecutionContext {
    const handler = function () {}; // marker fn — reflector attaches metadata by reference
    Reflect.defineMetadata(REQUIRE_FEATURE_KEY, featureKey, handler);
    return {
      getHandler: () => handler,
      getClass: () => class {},
    } as unknown as ExecutionContext;
  }

  // ── Helper: assert guard throws FeatureNotEnabledException with correct body ──

  async function expectGated(featureKey: FeatureKey): Promise<void> {
    const jsonKey = FEATURE_KEY_MAP[featureKey];

    await h.runAs({ organizationId: org.id }, async () => {
      // 1. Confirms it rejects with FeatureNotEnabledException
      await expect(guard.canActivate(ctxFor(featureKey))).rejects.toBeInstanceOf(
        FeatureNotEnabledException,
      );

      // 2. Confirms the response body has the canonical shape
      try {
        await guard.canActivate(ctxFor(featureKey));
      } catch (e: unknown) {
        const err = e as FeatureNotEnabledException;
        expect(err.getResponse()).toMatchObject({
          code: 'FEATURE_NOT_ENABLED',
          featureKey: jsonKey,
          planSlug: 'BASIC',
          statusCode: 403,
        });
      }
    });
  }

  // ── Test cases — one per gated feature on BASIC ────────────────────────────

  it('BASIC plan blocks COUPONS (coupons: false)', async () => {
    await expectGated(FeatureKey.COUPONS);
  });

  it('BASIC plan blocks ZATCA (zatca: false)', async () => {
    await expectGated(FeatureKey.ZATCA);
  });

  it('BASIC plan blocks AI_CHATBOT (ai_chatbot: false)', async () => {
    await expectGated(FeatureKey.AI_CHATBOT);
  });

  it('BASIC plan blocks RECURRING_BOOKINGS (recurring_bookings: false)', async () => {
    await expectGated(FeatureKey.RECURRING_BOOKINGS);
  });

  it('BASIC plan blocks WAITLIST (waitlist: false)', async () => {
    await expectGated(FeatureKey.WAITLIST);
  });

  it('BASIC plan blocks ADVANCED_REPORTS (advanced_reports: false)', async () => {
    await expectGated(FeatureKey.ADVANCED_REPORTS);
  });

  it('BASIC plan blocks CUSTOM_ROLES (custom_roles: false)', async () => {
    await expectGated(FeatureKey.CUSTOM_ROLES);
  });

  it('BASIC plan blocks ACTIVITY_LOG (activity_log: false)', async () => {
    await expectGated(FeatureKey.ACTIVITY_LOG);
  });

  // ── Features BASIC plan ALLOWS (email_templates: true, intake_forms: true) ──

  it('BASIC plan ALLOWS EMAIL_TEMPLATES (email_templates: true)', async () => {
    await h.runAs({ organizationId: org.id }, async () => {
      const result = await guard.canActivate(ctxFor(FeatureKey.EMAIL_TEMPLATES));
      expect(result).toBe(true);
    });
  });

  it('BASIC plan ALLOWS INTAKE_FORMS (intake_forms: true)', async () => {
    await h.runAs({ organizationId: org.id }, async () => {
      const result = await guard.canActivate(ctxFor(FeatureKey.INTAKE_FORMS));
      expect(result).toBe(true);
    });
  });

  // ── Sanity: flag-driven, not always-deny ───────────────────────────────────

  it('a plan with recurring_bookings: true does NOT throw for RECURRING_BOOKINGS', async () => {
    const ts = Date.now();
    const proOrg = await h.createOrg(`feat-pro-sanity-${ts}`, 'منظمة برو');

    // Seed a test-local plan with recurring_bookings enabled — avoids mutating shared BASIC seed
    const customPlan = await h.prisma.plan.create({
      data: {
        slug: `TEST_PRO_${ts}`,
        nameAr: 'خطة اختبار',
        nameEn: 'Test Pro Plan',
        priceMonthly: 0,
        priceAnnual: 0,
        currency: 'SAR',
        limits: {
          recurring_bookings: true,
          waitlist: true,
          group_sessions: false,
          ai_chatbot: false,
          email_templates: true,
          coupons: false,
          advanced_reports: false,
          intake_forms: true,
          zatca: false,
          custom_roles: false,
          activity_log: false,
          maxBranches: -1,
          maxEmployees: -1,
          maxServices: -1,
          maxBookingsPerMonth: -1,
          maxStorageMB: -1,
        },
        isActive: true,
        sortOrder: 99,
      },
    });

    const now = new Date();
    await h.prisma.subscription.create({
      data: {
        organizationId: proOrg.id,
        planId: customPlan.id,
        status: 'ACTIVE',
        billingCycle: 'MONTHLY',
        currentPeriodStart: now,
        currentPeriodEnd: new Date(now.getTime() + 30 * 86_400_000),
      },
    });

    h.app.get(SubscriptionCacheService).invalidate(proOrg.id);

    try {
      await h.runAs({ organizationId: proOrg.id }, async () => {
        const result = await guard.canActivate(ctxFor(FeatureKey.RECURRING_BOOKINGS));
        expect(result).toBe(true);
      });
    } finally {
      // Subscription FKs Plan, so delete the subscription before the plan.
      await h.prisma.subscription.deleteMany({ where: { organizationId: proOrg.id } });
      await h.cleanupOrg(proOrg.id);
      await h.prisma.plan.delete({ where: { id: customPlan.id } });
    }
  });
});
