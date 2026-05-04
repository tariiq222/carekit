/**
 * Phase 5 / Task 5.1 — Quantitative downgrade e2e (employees)
 *
 * Verifies that a PRO→BASIC downgrade with employees > cap is blocked with
 * HTTP 422, and that reducing usage below the cap allows the downgrade.
 */
import { FeatureKey } from '@deqah/shared/constants/feature-keys';
import { bootHarness, IsolationHarness } from '../../tenant-isolation/isolation-harness';
import { DowngradePlanHandler } from '../../../src/modules/platform/billing/downgrade-plan/downgrade-plan.handler';
import { DowngradePrecheckFailedException } from '../../../src/modules/platform/billing/downgrade-safety/downgrade-precheck.exception';
import { UsageCounterService } from '../../../src/modules/platform/billing/usage-counter/usage-counter.service';
import { EPOCH } from '../../../src/modules/platform/billing/usage-counter/period.util';
import { SubscriptionCacheService } from '../../../src/modules/platform/billing/subscription-cache.service';
import { SUPER_ADMIN_CONTEXT_CLS_KEY } from '../../../src/common/tenant/tenant.constants';

describe('Phase 5 / Task 5.1 — Quantitative downgrade e2e (employees)', () => {
  let h: IsolationHarness;
  let downgrade: DowngradePlanHandler;
  let counters: UsageCounterService;
  let cacheService: SubscriptionCacheService;
  let org: { id: string };
  let proPlanId: string;
  let basicPlanId: string;
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

    org = await h.createOrg(`dg-quant-${ts}`, 'منظمة اختبار كمي');

    const limitsBase = {
      recurring_bookings: true, waitlist: true, group_sessions: false,
      ai_chatbot: false, email_templates: true, coupons: true,
      advanced_reports: false, intake_forms: false, custom_roles: false,
      activity_log: false, maxBranches: -1, maxServices: -1, maxBookingsPerMonth: -1,
    };

    const pro = await runAsSuperAdmin(() =>
      h.prisma.$allTenants.plan.create({
        data: { slug: `DQ_PRO_${ts}`, nameAr: 'احترافي', nameEn: 'Pro',
          priceMonthly: 900, priceAnnual: 9000, currency: 'SAR',
          limits: { ...limitsBase, maxEmployees: 20 }, isActive: true, sortOrder: 100 },
        select: { id: true },
      }),
    );
    const basic = await runAsSuperAdmin(() =>
      h.prisma.$allTenants.plan.create({
        data: { slug: `DQ_BASIC_${ts}`, nameAr: 'أساسي', nameEn: 'Basic',
          priceMonthly: 300, priceAnnual: 3000, currency: 'SAR',
          limits: { ...limitsBase, maxEmployees: 5 }, isActive: true, sortOrder: 50 },
        select: { id: true },
      }),
    );
    proPlanId = pro.id;
    basicPlanId = basic.id;

    const now = new Date();
    await runAsSuperAdmin(() =>
      h.prisma.$allTenants.subscription.create({
        data: {
          organizationId: org.id, planId: proPlanId, status: 'ACTIVE',
          billingCycle: 'MONTHLY', currentPeriodStart: now,
          currentPeriodEnd: new Date(now.getTime() + 30 * 86_400_000),
        },
      }),
    );

    // Seed 12 active employees
    await h.runAs({ organizationId: org.id }, async () => {
      for (let i = 1; i <= 12; i++) {
        await h.prisma.employee.create({
          data: {
            organizationId: org.id,
            name: `Quant Emp ${i}`,
            nameAr: `موظف ${i}`,
            nameEn: `Quant Emp ${i}`,
            specialty: 'General',
            phone: `050${ts.toString().slice(-5)}${i}`.slice(0, 10),
          },
        });
      }
    });

    cacheService.invalidate(org.id);
    await runAsSuperAdmin(() =>
      counters.upsertExact(org.id, FeatureKey.EMPLOYEES, EPOCH, 12),
    );
  }, 60_000);

  afterAll(async () => {
    if (!h) return;
    await h.runAs({ organizationId: org.id }, async () => {
      await h.prisma.employee.deleteMany({ where: { organizationId: org.id } });
    });
    await runAsSuperAdmin(async () => {
      await h.prisma.$allTenants.subscription.deleteMany({ where: { organizationId: org.id } });
      await h.prisma.$allTenants.usageCounter.deleteMany({ where: { organizationId: org.id } });
    });
    await h.cleanupOrg(org.id);
    await runAsSuperAdmin(async () => {
      await h.prisma.$allTenants.plan.delete({ where: { id: basicPlanId } });
      await h.prisma.$allTenants.plan.delete({ where: { id: proPlanId } });
    });
    await h.close();
  });

  it('rejects downgrade when employees (12) exceed BASIC cap (5)', async () => {
    await expect(
      h.runAs({ organizationId: org.id }, () =>
        downgrade.execute({ planId: basicPlanId, billingCycle: 'MONTHLY' }),
      ),
    ).rejects.toBeInstanceOf(DowngradePrecheckFailedException);

    await expect(
      h.runAs({ organizationId: org.id }, () =>
        downgrade.execute({ planId: basicPlanId, billingCycle: 'MONTHLY' }),
      ),
    ).rejects.toMatchObject({
      status: 422,
      response: expect.objectContaining({
        code: 'DOWNGRADE_VIOLATES_NEW_LIMITS',
        violations: expect.arrayContaining([
          expect.objectContaining({ kind: 'QUANTITATIVE', featureKey: FeatureKey.EMPLOYEES, current: 12, targetMax: 5 }),
        ]),
      }),
    });
  });

  it('allows downgrade after reducing employees below cap', async () => {
    // Deactivate 7 employees so active count = 5
    const employees = await h.runAs({ organizationId: org.id }, () =>
      h.prisma.employee.findMany({
        where: { organizationId: org.id, isActive: true },
        select: { id: true },
        take: 7,
      }),
    );
    await h.runAs({ organizationId: org.id }, () =>
      h.prisma.employee.updateMany({
        where: { id: { in: employees.map(e => e.id) } },
        data: { isActive: false },
      }),
    );

    // Manually decrement counter to reflect deactivations
    await runAsSuperAdmin(() =>
      counters.upsertExact(org.id, FeatureKey.EMPLOYEES, EPOCH, 5),
    );
    cacheService.invalidate(org.id);

    const result = await h.runAs({ organizationId: org.id }, () =>
      downgrade.execute({ planId: basicPlanId, billingCycle: 'MONTHLY' }),
    );
    expect(result).toBeDefined();

    // Subscription must now point to basic plan
    const sub = await runAsSuperAdmin(() =>
      h.prisma.$allTenants.subscription.findFirst({
        where: { organizationId: org.id },
        select: { planId: true },
      }),
    );
    expect(sub?.planId).toBe(basicPlanId);
  });
});
