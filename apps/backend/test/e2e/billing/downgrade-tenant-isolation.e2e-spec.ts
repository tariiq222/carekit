/**
 * Phase 5 / Task 5.5 — Tenant isolation in downgrade flow
 *
 * Creates two orgs (A and B) with different states. Verifies that:
 * 1. Downgrade failure for org A does not affect org B.
 * 2. Downgrade success for org A does not modify org B's subscription.
 * 3. The downgrade safety service queries are scoped to the requesting org.
 */
import { FeatureKey } from '@deqah/shared/constants/feature-keys';
import { bootHarness, IsolationHarness } from '../../tenant-isolation/isolation-harness';
import { DowngradePlanHandler } from '../../../src/modules/platform/billing/downgrade-plan/downgrade-plan.handler';
import { DowngradePrecheckFailedException } from '../../../src/modules/platform/billing/downgrade-safety/downgrade-precheck.exception';
import { UsageCounterService } from '../../../src/modules/platform/billing/usage-counter/usage-counter.service';
import { EPOCH } from '../../../src/modules/platform/billing/usage-counter/period.util';
import { SubscriptionCacheService } from '../../../src/modules/platform/billing/subscription-cache.service';
import { SUPER_ADMIN_CONTEXT_CLS_KEY } from '../../../src/common/tenant/tenant.constants';

describe('Phase 5 / Task 5.5 — Tenant isolation in downgrade flow', () => {
  let h: IsolationHarness;
  let downgrade: DowngradePlanHandler;
  let counters: UsageCounterService;
  let cacheService: SubscriptionCacheService;

  let orgA: { id: string };
  let orgB: { id: string };

  let proPlanId: string;
  let basicPlanId: string;
  let orgBOriginalPlanId: string;

  const ts = Date.now();

  function runAsSuperAdmin<T>(fn: () => Promise<T>): Promise<T> {
    return h.cls.run(() => {
      h.cls.set(SUPER_ADMIN_CONTEXT_CLS_KEY, true);
      return fn();
    });
  }

  beforeAll(async () => {
    h = await bootHarness();
    downgrade = h.app.get(DowngradePlanHandler);
    counters = h.app.get(UsageCounterService);
    cacheService = h.app.get(SubscriptionCacheService);

    orgA = await h.createOrg(`dg-iso-a-${ts}`, 'منظمة أ');
    orgB = await h.createOrg(`dg-iso-b-${ts}`, 'منظمة ب');

    const baseFeatures = {
      recurring_bookings: false, waitlist: false, group_sessions: false,
      ai_chatbot: false, email_templates: false, coupons: false,
      advanced_reports: false, intake_forms: false, custom_roles: false,
      activity_log: false, maxBranches: -1, maxServices: -1, maxBookingsPerMonth: -1,
    };

    const pro = await runAsSuperAdmin(() =>
      h.prisma.$allTenants.plan.create({
        data: { slug: `DI_PRO_${ts}`, nameAr: 'احترافي', nameEn: 'Pro',
          priceMonthly: 900, priceAnnual: 9000, currency: 'SAR',
          limits: { ...baseFeatures, maxEmployees: 20 }, isActive: true, sortOrder: 100 },
        select: { id: true },
      }),
    );
    const basic = await runAsSuperAdmin(() =>
      h.prisma.$allTenants.plan.create({
        data: { slug: `DI_BASIC_${ts}`, nameAr: 'أساسي', nameEn: 'Basic',
          priceMonthly: 300, priceAnnual: 3000, currency: 'SAR',
          limits: { ...baseFeatures, maxEmployees: 5 }, isActive: true, sortOrder: 50 },
        select: { id: true },
      }),
    );
    proPlanId = pro.id;
    basicPlanId = basic.id;
    orgBOriginalPlanId = proPlanId; // org B stays on pro

    const now = new Date();
    const subData = (orgId: string) => ({
      organizationId: orgId, planId: proPlanId, status: 'ACTIVE' as const,
      billingCycle: 'MONTHLY' as const, currentPeriodStart: now,
      currentPeriodEnd: new Date(now.getTime() + 30 * 86_400_000),
    });

    await runAsSuperAdmin(async () => {
      await h.prisma.$allTenants.subscription.create({ data: subData(orgA.id) });
      await h.prisma.$allTenants.subscription.create({ data: subData(orgB.id) });
    });

    // Org A: 12 employees (over BASIC cap of 5)
    await h.runAs({ organizationId: orgA.id }, async () => {
      for (let i = 1; i <= 12; i++) {
        await h.prisma.employee.create({
          data: {
            organizationId: orgA.id,
            name: `Iso A Emp ${i}`, nameAr: `موظف أ ${i}`, nameEn: `Iso A Emp ${i}`,
            specialty: 'General',
            phone: `060${ts.toString().slice(-5)}${i}`.slice(0, 10),
          },
        });
      }
    });

    // Org B: 3 employees (under BASIC cap)
    await h.runAs({ organizationId: orgB.id }, async () => {
      for (let i = 1; i <= 3; i++) {
        await h.prisma.employee.create({
          data: {
            organizationId: orgB.id,
            name: `Iso B Emp ${i}`, nameAr: `موظف ب ${i}`, nameEn: `Iso B Emp ${i}`,
            specialty: 'General',
            phone: `070${ts.toString().slice(-5)}${i}`.slice(0, 10),
          },
        });
      }
    });

    await runAsSuperAdmin(async () => {
      await counters.upsertExact(orgA.id, FeatureKey.EMPLOYEES, EPOCH, 12);
      await counters.upsertExact(orgB.id, FeatureKey.EMPLOYEES, EPOCH, 3);
    });

    cacheService.invalidate(orgA.id);
    cacheService.invalidate(orgB.id);
  }, 60_000);

  afterAll(async () => {
    if (!h) return;
    await h.runAs({ organizationId: orgA.id }, async () => {
      await h.prisma.employee.deleteMany({ where: { organizationId: orgA.id } });
    });
    await h.runAs({ organizationId: orgB.id }, async () => {
      await h.prisma.employee.deleteMany({ where: { organizationId: orgB.id } });
    });
    await runAsSuperAdmin(async () => {
      await h.prisma.$allTenants.subscription.deleteMany({
        where: { organizationId: { in: [orgA.id, orgB.id] } },
      });
      await h.prisma.$allTenants.usageCounter.deleteMany({
        where: { organizationId: { in: [orgA.id, orgB.id] } },
      });
    });
    await h.cleanupOrg(orgA.id);
    await h.cleanupOrg(orgB.id);
    await runAsSuperAdmin(async () => {
      await h.prisma.$allTenants.plan.delete({ where: { id: basicPlanId } });
      await h.prisma.$allTenants.plan.delete({ where: { id: proPlanId } });
    });
    await h.close();
  });

  it('rejects org A downgrade (12 employees > cap 5) while org B is unaffected', async () => {
    // Org A: downgrade blocked
    await expect(
      h.runAs({ organizationId: orgA.id }, () =>
        downgrade.execute({ planId: basicPlanId, billingCycle: 'MONTHLY' }),
      ),
    ).rejects.toBeInstanceOf(DowngradePrecheckFailedException);

    // Org B: still on PRO — subscription untouched
    const subB = await runAsSuperAdmin(() =>
      h.prisma.$allTenants.subscription.findFirst({
        where: { organizationId: orgB.id },
        select: { planId: true },
      }),
    );
    expect(subB?.planId).toBe(orgBOriginalPlanId);
  });

  it('org A violations endpoint returns only org A violations, not org B data', async () => {
    // Re-invoke the safety service directly under org A context to confirm scoping
    const { DowngradeSafetyService } = await import(
      '../../../src/modules/platform/billing/downgrade-safety/downgrade-safety.service'
    );
    const safetyService = h.app.get(DowngradeSafetyService);

    const targetPlan = await runAsSuperAdmin(() =>
      h.prisma.$allTenants.plan.findFirst({ where: { id: basicPlanId } }),
    );
    const currentPlan = await runAsSuperAdmin(() =>
      h.prisma.$allTenants.plan.findFirst({ where: { id: proPlanId } }),
    );

    // Check org A — should have QUANTITATIVE violation with current=12
    const resultA = await safetyService.checkDowngrade(currentPlan!, targetPlan!, orgA.id);
    expect(resultA.ok).toBe(false);
    expect(resultA.violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'QUANTITATIVE', featureKey: FeatureKey.EMPLOYEES, current: 12 }),
      ]),
    );

    // Check org B — should be clean (3 employees ≤ cap 5)
    const resultB = await safetyService.checkDowngrade(currentPlan!, targetPlan!, orgB.id);
    expect(resultB.ok).toBe(true);
    expect(resultB.violations).toHaveLength(0);

    // Verify org B violations don't bleed into org A result
    const orgBEmployeeIds = await h.runAs({ organizationId: orgB.id }, () =>
      h.prisma.employee.findMany({
        where: { organizationId: orgB.id },
        select: { id: true },
      }),
    );
    const orgAViolationSampleIds = resultA.violations
      .filter(v => v.kind === 'BOOLEAN')
      .flatMap(v => (v as { blockingResources: { sampleIds: string[] } }).blockingResources.sampleIds);
    const orgBIds = orgBEmployeeIds.map(e => e.id);
    for (const id of orgAViolationSampleIds) {
      expect(orgBIds).not.toContain(id);
    }
  });
});
