/**
 * Phase 6 / Task 9 — Full-loop e2e: admin override → tenant features → guard.
 *
 * Tests the complete pipeline:
 * 1. FeatureGuard blocks COUPONS on BASIC plan (plan-limit gate).
 * 2. UpsertFeatureFlagOverrideHandler sets zoom_integration=FORCE_OFF
 *    (zoom_integration is in the FeatureFlag catalog; no plan-limit entry).
 * 3. GetMyFeaturesHandler returns zoom_integration.enabled=false after FORCE_OFF.
 * 4. UpsertFeatureFlagOverrideHandler sets zoom_integration=FORCE_ON.
 * 5. After cache flush, GetMyFeaturesHandler returns zoom_integration.enabled=true.
 * 6. SuperAdminActionLog row exists with correct payload.
 * 7. Cleanup: INHERIT removes the override row.
 *
 * Architecture note: GetMyFeaturesHandler reads org-scoped FeatureFlag rows
 * under tenant CLS (platform catalog rows are filtered by the scoping extension).
 * FeatureGuard reads plan limits only (not catalog flags). These are separate
 * enforcement paths tested independently.
 */
import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { bootHarness, IsolationHarness } from '../../tenant-isolation/isolation-harness';
import { FeatureGuard } from '../../../src/modules/platform/billing/feature.guard';
import { SubscriptionCacheService } from '../../../src/modules/platform/billing/subscription-cache.service';
import { TenantContextService } from '../../../src/common/tenant/tenant-context.service';
import { REQUIRE_FEATURE_KEY } from '../../../src/modules/platform/billing/feature.decorator';
import { FeatureNotEnabledException } from '../../../src/modules/platform/billing/feature-not-enabled.exception';
import { FeatureKey } from '@deqah/shared/constants/feature-keys';
import { UsageCounterService } from '../../../src/modules/platform/billing/usage-counter/usage-counter.service';
import { GetMyFeaturesHandler } from '../../../src/modules/platform/billing/get-my-features/get-my-features.handler';
import { UpsertFeatureFlagOverrideHandler } from '../../../src/modules/platform/feature-flags/upsert-feature-flag-override/upsert-feature-flag-override.handler';
import { SUPER_ADMIN_CONTEXT_CLS_KEY } from '../../../src/common/tenant/tenant.constants';

describe('Phase 6 / Task 9 — full-loop e2e (admin override → tenant features → guard)', () => {
  let h: IsolationHarness;
  let guard: FeatureGuard;
  let getFeaturesHandler: GetMyFeaturesHandler;
  let upsertOverrideHandler: UpsertFeatureFlagOverrideHandler;
  let cacheService: SubscriptionCacheService;
  let org: { id: string };
  let BASIC_PLAN_ID: string;
  const SUPER_ADMIN_ID = '00000000-0000-0000-0000-000000000099';

  beforeAll(async () => {
    process.env.MOYASAR_PLATFORM_SECRET_KEY ??= 'test-platform-secret-key';
    process.env.MOYASAR_PLATFORM_WEBHOOK_SECRET ??= 'test-platform-webhook-secret';

    h = await bootHarness();

    const basicPlan = await h.prisma.plan.findFirst({ where: { slug: 'BASIC' } });
    if (!basicPlan) throw new Error('BASIC plan not found — run migrations + seed first');
    BASIC_PLAN_ID = basicPlan.id;

    const ts = Date.now();
    org = await h.createOrg(`full-loop-${ts}`, 'منظمة اختبار حلقة كاملة');

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

    cacheService = h.app.get(SubscriptionCacheService);
    getFeaturesHandler = h.app.get(GetMyFeaturesHandler);
    upsertOverrideHandler = h.app.get(UpsertFeatureFlagOverrideHandler);

    guard = new FeatureGuard(
      h.app.get(Reflector),
      h.prisma,
      h.app.get(TenantContextService),
      cacheService,
      h.app.get(UsageCounterService),
    );

    FeatureGuard.invalidate(org.id);
    cacheService.invalidate(org.id);
  });

  afterAll(async () => {
    if (h) {
      await h.cleanupOrg(org.id);
      await h.close();
    }
  });

  /** Run fn with super-admin CLS context (required by $allTenants prisma accessor). */
  function runAsSuperAdmin<T>(fn: () => Promise<T>): Promise<T> {
    return h.cls.run(() => {
      h.cls.set(SUPER_ADMIN_CONTEXT_CLS_KEY, true);
      return fn();
    });
  }

  /**
   * Run fn with BOTH tenant CLS context AND super-admin CLS context.
   * GetMyFeaturesHandler and FeatureGuard need tenant context (requireOrganizationId)
   * and UsageCounterService needs $allTenants (super-admin context) for quota reads.
   */
  function runAsOrgWithSuperAdmin<T>(organizationId: string, fn: () => Promise<T>): Promise<T> {
    return h.cls.run(() => {
      h.cls.set(SUPER_ADMIN_CONTEXT_CLS_KEY, true);
      h.ctx.set({
        organizationId,
        membershipId: '',
        id: '',
        role: 'ADMIN',
        isSuperAdmin: false,
      });
      return fn();
    });
  }

  function ctxFor(featureKey: FeatureKey): ExecutionContext {
    const handler = function () {};
    Reflect.defineMetadata(REQUIRE_FEATURE_KEY, featureKey, handler);
    return {
      getHandler: () => handler,
      getClass: () => class {},
    } as unknown as ExecutionContext;
  }

  // ── Step 1: FeatureGuard blocks COUPONS (plan-limit gate) ──────────────────

  it('Step 1: FeatureGuard throws FeatureNotEnabledException for COUPONS on BASIC', async () => {
    await runAsOrgWithSuperAdmin(org.id, async () => {
      await expect(guard.canActivate(ctxFor(FeatureKey.COUPONS))).rejects.toBeInstanceOf(
        FeatureNotEnabledException,
      );
    });
  });

  // ── Step 2: Override handler FORCE_OFF for zoom_integration (catalog feature) ──

  it('Step 2: UpsertFeatureFlagOverrideHandler FORCE_OFF → { success: true }', async () => {
    const result = await runAsSuperAdmin(() =>
      upsertOverrideHandler.execute({
        organizationId: org.id,
        key: 'zoom_integration',
        mode: 'FORCE_OFF',
        reason: 'e2e: full-loop FORCE_OFF override for zoom_integration',
        superAdminUserId: SUPER_ADMIN_ID,
      }),
    );
    expect(result).toEqual({ success: true });
  });

  // ── Step 3: GetMyFeaturesHandler returns zoom_integration.enabled=false ────

  it('Step 3: GetMyFeaturesHandler returns zoom_integration.enabled=false after FORCE_OFF', async () => {
    await runAsOrgWithSuperAdmin(org.id, async () => {
      const result = await getFeaturesHandler.execute();
      expect(result.features['zoom_integration']?.enabled).toBe(false);
    });
  });

  // ── Step 4: Override to FORCE_ON ──────────────────────────────────────────

  it('Step 4: UpsertFeatureFlagOverrideHandler FORCE_ON → { success: true }', async () => {
    const result = await runAsSuperAdmin(() =>
      upsertOverrideHandler.execute({
        organizationId: org.id,
        key: 'zoom_integration',
        mode: 'FORCE_ON',
        reason: 'e2e: full-loop FORCE_ON override for zoom_integration',
        superAdminUserId: SUPER_ADMIN_ID,
      }),
    );
    expect(result).toEqual({ success: true });
  });

  // ── Step 5: After cache invalidation, zoom_integration.enabled=true ────────

  it('Step 5: after cache invalidation, zoom_integration.enabled=true', async () => {
    FeatureGuard.invalidate(org.id);
    cacheService.invalidate(org.id);

    await runAsOrgWithSuperAdmin(org.id, async () => {
      const result = await getFeaturesHandler.execute();
      expect(result.features['zoom_integration']?.enabled).toBe(true);
    });
  });

  // ── Step 6: SuperAdminActionLog entry ──────────────────────────────────────

  it('Step 6: SuperAdminActionLog has FEATURE_FLAG_UPDATE row with correct payload', async () => {
    const log = await runAsSuperAdmin(() =>
      h.prisma.$allTenants.superAdminActionLog.findFirst({
        where: {
          actionType: 'FEATURE_FLAG_UPDATE',
          organizationId: org.id,
        },
        orderBy: { createdAt: 'desc' },
      }),
    );

    expect(log).not.toBeNull();
    expect(log?.reason).toBe('e2e: full-loop FORCE_ON override for zoom_integration');
    const meta = log?.metadata as Record<string, string>;
    expect(meta?.key).toBe('zoom_integration');
    expect(meta?.mode).toBe('FORCE_ON');
  });

  // ── Step 7: Cleanup — reset to INHERIT ─────────────────────────────────────

  it('Step 7: setting mode=INHERIT removes the override row', async () => {
    await runAsSuperAdmin(() =>
      upsertOverrideHandler.execute({
        organizationId: org.id,
        key: 'zoom_integration',
        mode: 'INHERIT',
        reason: 'e2e: cleanup — reset to plan default',
        superAdminUserId: SUPER_ADMIN_ID,
      }),
    );

    // Verify no org-scoped FeatureFlag row remains
    // FeatureFlag is in SCOPED_MODELS — use tenant CLS context for reads
    const row = await h.runAs({ organizationId: org.id }, () =>
      h.prisma.featureFlag.findFirst({
        where: { organizationId: org.id, key: 'zoom_integration' },
      }),
    );
    expect(row).toBeNull();

    // And after flushing cache, zoom_integration reverts to default (no override)
    FeatureGuard.invalidate(org.id);
    cacheService.invalidate(org.id);

    // After INHERIT, no org-specific row exists → handler falls to plan-limit absence → true
    await runAsOrgWithSuperAdmin(org.id, async () => {
      const result = await getFeaturesHandler.execute();
      // zoom_integration not in plan limits → defaults to true (no plan limit restriction)
      expect(result.features['zoom_integration']?.enabled).toBe(true);
    });
  });
});
