/**
 * Phase 2 / Bug B8 — Downgrade pre-check e2e.
 *
 * Tenant on PRO plan (maxEmployees=20) with 12 active employees attempts to
 * downgrade immediately to BASIC (maxEmployees=5). The handler must throw
 * DowngradePrecheckFailedException (HTTP 422) listing the violation rather
 * than silently swap the plan and lock the tenant out.
 */
import { FeatureKey } from '@deqah/shared/constants/feature-keys';
import { bootHarness, IsolationHarness } from '../../tenant-isolation/isolation-harness';
import { DowngradePlanHandler } from '../../../src/modules/platform/billing/downgrade-plan/downgrade-plan.handler';
import { DowngradePrecheckFailedException } from '../../../src/modules/platform/billing/downgrade-safety/downgrade-precheck.exception';
import { UsageCounterService } from '../../../src/modules/platform/billing/usage-counter/usage-counter.service';
import { EPOCH } from '../../../src/modules/platform/billing/usage-counter/period.util';
import { SubscriptionCacheService } from '../../../src/modules/platform/billing/subscription-cache.service';
import { SUPER_ADMIN_CONTEXT_CLS_KEY } from '../../../src/common/tenant/tenant.constants';

describe('Bug B8 — Downgrade pre-check e2e (employees over BASIC cap)', () => {
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
    counters = h.app.get(UsageCounterService);
    downgrade = h.app.get(DowngradePlanHandler);
    cacheService = h.app.get(SubscriptionCacheService);

    org = await h.createOrg(`downgrade-precheck-${ts}`, 'منظمة اختبار التخفيض');

    const limitsPro = {
      recurring_bookings: true,
      waitlist: true,
      group_sessions: false,
      ai_chatbot: false,
      email_templates: true,
      coupons: true,
      advanced_reports: false,
      intake_forms: true,
      custom_roles: false,
      activity_log: false,
      maxBranches: -1,
      maxEmployees: 20,
      maxServices: -1,
      maxBookingsPerMonth: -1,
    };
    const limitsBasic = { ...limitsPro, maxEmployees: 5 };

    const pro = await runAsSuperAdmin(() =>
      h.prisma.$allTenants.plan.create({
        data: {
          slug: `B8_PRO_${ts}`,
          nameAr: 'احترافي',
          nameEn: 'Pro',
          priceMonthly: 900,
          priceAnnual: 9000,
          currency: 'SAR',
          limits: limitsPro,
          isActive: true,
          sortOrder: 100,
        },
        select: { id: true },
      }),
    );
    const basic = await runAsSuperAdmin(() =>
      h.prisma.$allTenants.plan.create({
        data: {
          slug: `B8_BASIC_${ts}`,
          nameAr: 'أساسي',
          nameEn: 'Basic',
          priceMonthly: 300,
          priceAnnual: 3000,
          currency: 'SAR',
          limits: limitsBasic,
          isActive: true,
          sortOrder: 50,
        },
        select: { id: true },
      }),
    );
    proPlanId = pro.id;
    basicPlanId = basic.id;

    const now = new Date();
    await runAsSuperAdmin(() =>
      h.prisma.$allTenants.subscription.create({
        data: {
          organizationId: org.id,
          planId: proPlanId,
          status: 'ACTIVE',
          billingCycle: 'MONTHLY',
          currentPeriodStart: now,
          currentPeriodEnd: new Date(now.getTime() + 30 * 86_400_000),
        },
      }),
    );

    // Seed 12 employees under tenant CLS context
    await h.runAs({ organizationId: org.id }, async () => {
      for (let i = 1; i <= 12; i++) {
        await h.prisma.employee.create({
          data: {
            organizationId: org.id,
            name: `B8 Emp ${i}`,
            nameAr: `موظف ${i}`,
            nameEn: `B8 Emp ${i}`,
            specialty: 'General',
            phone: `0500${ts.toString().slice(-4)}${i}`.slice(0, 10),
          },
        });
      }
    });

    cacheService.invalidate(org.id);
    await runAsSuperAdmin(() =>
      counters.upsertExact(org.id, FeatureKey.EMPLOYEES, EPOCH, 12),
    );
  });

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
      await h.prisma.$allTenants.plan.delete({ where: { id: proPlanId } });
      await h.prisma.$allTenants.plan.delete({ where: { id: basicPlanId } });
    });
    await h.close();
  });

  it('rejects PRO→BASIC downgrade with 422 + violation listing employees=12, target=5', async () => {
    await expect(
      h.runAs({ organizationId: org.id }, () =>
        downgrade.execute({ planId: basicPlanId, billingCycle: 'MONTHLY' }),
      ),
    ).rejects.toMatchObject({
      status: 422,
      response: expect.objectContaining({
        code: 'DOWNGRADE_VIOLATES_NEW_LIMITS',
        violations: expect.arrayContaining([
          expect.objectContaining({
            kind: FeatureKey.EMPLOYEES,
            current: 12,
            targetMax: 5,
          }),
        ]),
      }),
    });

    // Defense-in-depth: also assert it's specifically the new exception type.
    await expect(
      h.runAs({ organizationId: org.id }, () =>
        downgrade.execute({ planId: basicPlanId, billingCycle: 'MONTHLY' }),
      ),
    ).rejects.toBeInstanceOf(DowngradePrecheckFailedException);

    // Subscription must NOT have been swapped — still on PRO plan.
    const sub = await runAsSuperAdmin(() =>
      h.prisma.$allTenants.subscription.findFirst({
        where: { organizationId: org.id },
        select: { planId: true },
      }),
    );
    expect(sub?.planId).toBe(proPlanId);
  });
});
