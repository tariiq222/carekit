/**
 * Phase 5 / Task 5.2 — Boolean downgrade e2e (coupons)
 *
 * Verifies that a downgrade to a plan with coupons:false is blocked when the
 * org has active coupons, and allowed after deactivating them.
 */
import { FeatureKey } from '@deqah/shared/constants/feature-keys';
import { bootHarness, IsolationHarness } from '../../tenant-isolation/isolation-harness';
import { DowngradePlanHandler } from '../../../src/modules/platform/billing/downgrade-plan/downgrade-plan.handler';
import { DowngradePrecheckFailedException } from '../../../src/modules/platform/billing/downgrade-safety/downgrade-precheck.exception';
import { SubscriptionCacheService } from '../../../src/modules/platform/billing/subscription-cache.service';
import { SUPER_ADMIN_CONTEXT_CLS_KEY } from '../../../src/common/tenant/tenant.constants';

describe('Phase 5 / Task 5.2 — Boolean downgrade e2e (coupons)', () => {
  let h: IsolationHarness;
  let downgrade: DowngradePlanHandler;
  let cacheService: SubscriptionCacheService;
  let org: { id: string };
  let proPlanId: string;
  let basicPlanId: string;
  let couponId: string;
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
    cacheService = h.app.get(SubscriptionCacheService);

    org = await h.createOrg(`dg-bool-${ts}`, 'منظمة اختبار منطقي');

    const baseFeatures = {
      recurring_bookings: true, waitlist: true, group_sessions: false,
      ai_chatbot: false, email_templates: true, advanced_reports: false,
      intake_forms: false, custom_roles: false, activity_log: false,
      maxBranches: -1, maxEmployees: -1, maxServices: -1, maxBookingsPerMonth: -1,
    };

    const pro = await runAsSuperAdmin(() =>
      h.prisma.$allTenants.plan.create({
        data: { slug: `DB_PRO_${ts}`, nameAr: 'احترافي', nameEn: 'Pro',
          priceMonthly: 900, priceAnnual: 9000, currency: 'SAR',
          limits: { ...baseFeatures, coupons: true }, isActive: true, sortOrder: 100 },
        select: { id: true },
      }),
    );
    const basic = await runAsSuperAdmin(() =>
      h.prisma.$allTenants.plan.create({
        data: { slug: `DB_BASIC_${ts}`, nameAr: 'أساسي', nameEn: 'Basic',
          priceMonthly: 300, priceAnnual: 3000, currency: 'SAR',
          limits: { ...baseFeatures, coupons: false }, isActive: true, sortOrder: 50 },
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

    // Seed one active coupon
    const coupon = await h.runAs({ organizationId: org.id }, () =>
      h.prisma.coupon.create({
        data: {
          organizationId: org.id,
          code: `TESTCOUPON${ts}`,
          discountType: 'PERCENTAGE',
          discountValue: 10,
          isActive: true,
        },
        select: { id: true },
      }),
    );
    couponId = coupon.id;

    cacheService.invalidate(org.id);
  }, 60_000);

  afterAll(async () => {
    if (!h) return;
    await h.runAs({ organizationId: org.id }, async () => {
      await h.prisma.coupon.deleteMany({ where: { organizationId: org.id } });
    });
    await runAsSuperAdmin(async () => {
      await h.prisma.$allTenants.subscription.deleteMany({ where: { organizationId: org.id } });
    });
    await h.cleanupOrg(org.id);
    await runAsSuperAdmin(async () => {
      await h.prisma.$allTenants.plan.delete({ where: { id: basicPlanId } });
      await h.prisma.$allTenants.plan.delete({ where: { id: proPlanId } });
    });
    await h.close();
  });

  it('rejects downgrade when org has active coupons and target plan disables coupons', async () => {
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
          expect.objectContaining({ kind: 'BOOLEAN', featureKey: FeatureKey.COUPONS }),
        ]),
      }),
    });
  });

  it('allows downgrade after deactivating all coupons', async () => {
    // Deactivate the coupon
    await h.runAs({ organizationId: org.id }, () =>
      h.prisma.coupon.update({
        where: { id: couponId },
        data: { isActive: false },
      }),
    );
    cacheService.invalidate(org.id);

    const result = await h.runAs({ organizationId: org.id }, () =>
      downgrade.execute({ planId: basicPlanId, billingCycle: 'MONTHLY' }),
    );
    expect(result).toBeDefined();

    // Subscription now points to basic plan
    const sub = await runAsSuperAdmin(() =>
      h.prisma.$allTenants.subscription.findFirst({
        where: { organizationId: org.id },
        select: { planId: true },
      }),
    );
    expect(sub?.planId).toBe(basicPlanId);
  });
});
