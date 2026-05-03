/**
 * Phase 6 / Task 10 — Tenant isolation e2e for feature-flag overrides.
 *
 * Seeds 2 orgs (A and B) on the same plan (PRO).
 * zoom_integration is enabled=true on PRO (seeded by migration
 * 20260503040000_seed_phase3_feature_keys_into_plans). Both orgs see
 * enabled=true at baseline.
 * Sets zoom_integration=FORCE_OFF for org A only.
 * Asserts:
 *   - Tenant A: GetMyFeaturesHandler returns zoom_integration.enabled=false (override applied)
 *   - Tenant B: GetMyFeaturesHandler returns zoom_integration.enabled=true (default unchanged)
 * Confirms FeatureFlag row scoping respects SCOPED_MODELS (organizationId).
 */
import { bootHarness, IsolationHarness } from '../../tenant-isolation/isolation-harness';
import { SubscriptionCacheService } from '../../../src/modules/platform/billing/subscription-cache.service';
import { FeatureGuard } from '../../../src/modules/platform/billing/feature.guard';
import { GetMyFeaturesHandler } from '../../../src/modules/platform/billing/get-my-features/get-my-features.handler';
import { UpsertFeatureFlagOverrideHandler } from '../../../src/modules/platform/feature-flags/upsert-feature-flag-override/upsert-feature-flag-override.handler';
import { SUPER_ADMIN_CONTEXT_CLS_KEY } from '../../../src/common/tenant/tenant.constants';

describe('Phase 6 / Task 10 — Override tenant isolation (org A override invisible to org B)', () => {
  let h: IsolationHarness;
  let getFeaturesHandler: GetMyFeaturesHandler;
  let upsertOverrideHandler: UpsertFeatureFlagOverrideHandler;
  let cacheService: SubscriptionCacheService;
  let orgA: { id: string };
  let orgB: { id: string };
  let PRO_PLAN_ID: string;
  const SUPER_ADMIN_ID = '00000000-0000-0000-0000-000000000099';
  const ts = Date.now();

  beforeAll(async () => {
    process.env.MOYASAR_PLATFORM_SECRET_KEY ??= 'test-platform-secret-key';
    process.env.MOYASAR_PLATFORM_WEBHOOK_SECRET ??= 'test-platform-webhook-secret';

    h = await bootHarness();

    const proPlan = await h.prisma.plan.findFirst({ where: { slug: 'PRO' } });
    if (!proPlan) throw new Error('PRO plan not found — run migrations + seed first');
    PRO_PLAN_ID = proPlan.id;

    orgA = await h.createOrg(`isolation-org-a-${ts}`, 'منظمة أ');
    orgB = await h.createOrg(`isolation-org-b-${ts}`, 'منظمة ب');

    const now = new Date();
    const periodEnd = new Date(now.getTime() + 30 * 86_400_000);

    await h.prisma.subscription.create({
      data: {
        organizationId: orgA.id,
        planId: PRO_PLAN_ID,
        status: 'ACTIVE',
        billingCycle: 'MONTHLY',
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
      },
    });

    await h.prisma.subscription.create({
      data: {
        organizationId: orgB.id,
        planId: PRO_PLAN_ID,
        status: 'ACTIVE',
        billingCycle: 'MONTHLY',
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
      },
    });

    cacheService = h.app.get(SubscriptionCacheService);
    getFeaturesHandler = h.app.get(GetMyFeaturesHandler);
    upsertOverrideHandler = h.app.get(UpsertFeatureFlagOverrideHandler);

    FeatureGuard.invalidate(orgA.id);
    FeatureGuard.invalidate(orgB.id);
    cacheService.invalidate(orgA.id);
    cacheService.invalidate(orgB.id);
  });

  afterAll(async () => {
    if (h) {
      await h.cleanupOrg(orgA.id);
      await h.cleanupOrg(orgB.id);
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
   * GetMyFeaturesHandler needs tenant context (requireOrganizationId)
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

  it('baseline: both orgs have zoom_integration.enabled=true (PRO seeded with zoom_integration=true)', async () => {
    await runAsOrgWithSuperAdmin(orgA.id, async () => {
      const result = await getFeaturesHandler.execute();
      expect(result.features['zoom_integration']?.enabled).toBe(true);
    });

    await runAsOrgWithSuperAdmin(orgB.id, async () => {
      const result = await getFeaturesHandler.execute();
      expect(result.features['zoom_integration']?.enabled).toBe(true);
    });
  });

  it('applying FORCE_OFF override to org A only', async () => {
    const result = await runAsSuperAdmin(() =>
      upsertOverrideHandler.execute({
        organizationId: orgA.id,
        key: 'zoom_integration',
        mode: 'FORCE_OFF',
        reason: 'e2e isolation test: disable zoom_integration for org A only',
        superAdminUserId: SUPER_ADMIN_ID,
      }),
    );
    expect(result).toEqual({ success: true });

    // Flush cache for org A
    FeatureGuard.invalidate(orgA.id);
    cacheService.invalidate(orgA.id);
  });

  it('org A: zoom_integration.enabled=false after FORCE_OFF override', async () => {
    await runAsOrgWithSuperAdmin(orgA.id, async () => {
      const result = await getFeaturesHandler.execute();
      expect(result.features['zoom_integration']?.enabled).toBe(false);
    });
  });

  it('org B: zoom_integration.enabled=true — default unchanged, override not leaked', async () => {
    // Ensure org B cache is fresh (no cross-org contamination)
    FeatureGuard.invalidate(orgB.id);
    cacheService.invalidate(orgB.id);

    await runAsOrgWithSuperAdmin(orgB.id, async () => {
      const result = await getFeaturesHandler.execute();
      expect(result.features['zoom_integration']?.enabled).toBe(true);
    });
  });

  it('DB: FeatureFlag override row scoped to org A only — org B has no override row', async () => {
    // FeatureFlag is in SCOPED_MODELS — use tenant CLS context for reads
    const orgARow = await h.runAs({ organizationId: orgA.id }, () =>
      h.prisma.featureFlag.findFirst({
        where: { organizationId: orgA.id, key: 'zoom_integration' },
      }),
    );
    expect(orgARow).not.toBeNull();
    expect(orgARow?.enabled).toBe(false);

    const orgBRow = await h.runAs({ organizationId: orgB.id }, () =>
      h.prisma.featureFlag.findFirst({
        where: { organizationId: orgB.id, key: 'zoom_integration' },
      }),
    );
    expect(orgBRow).toBeNull();
  });

  it('cleanup: reset org A override to INHERIT', async () => {
    await runAsSuperAdmin(() =>
      upsertOverrideHandler.execute({
        organizationId: orgA.id,
        key: 'zoom_integration',
        mode: 'INHERIT',
        reason: 'e2e isolation test: cleanup reset',
        superAdminUserId: SUPER_ADMIN_ID,
      }),
    );

    const row = await h.runAs({ organizationId: orgA.id }, () =>
      h.prisma.featureFlag.findFirst({
        where: { organizationId: orgA.id, key: 'zoom_integration' },
      }),
    );
    expect(row).toBeNull();
  });
});
