/**
 * Phase 5 / Task 5.3 — Grace columns (api_access + webhooks) set on downgrade
 *
 * Verifies that when a plan downgrade removes api_access and/or webhooks, the
 * grace columns (apiAccessGraceUntil / webhooksGraceUntil) are written on the
 * Subscription row with a ~7-day window.
 *
 * Note: No ApiKeyGuard exists in this codebase — the 402 enforcement path is
 * not implemented. This spec only verifies grace column writes, per Phase 3
 * findings.
 */
import { bootHarness, IsolationHarness } from '../../tenant-isolation/isolation-harness';
import { DowngradePlanHandler } from '../../../src/modules/platform/billing/downgrade-plan/downgrade-plan.handler';
import { SubscriptionCacheService } from '../../../src/modules/platform/billing/subscription-cache.service';
import { SUPER_ADMIN_CONTEXT_CLS_KEY } from '../../../src/common/tenant/tenant.constants';

describe('Phase 5 / Task 5.3 — Grace columns set on api_access + webhooks downgrade', () => {
  let h: IsolationHarness;
  let downgrade: DowngradePlanHandler;
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
    cacheService = h.app.get(SubscriptionCacheService);

    org = await h.createOrg(`dg-grace-aw-${ts}`, 'منظمة اختبار grace');

    const baseFeatures = {
      recurring_bookings: false, waitlist: false, group_sessions: false,
      ai_chatbot: false, email_templates: false, coupons: false,
      advanced_reports: false, intake_forms: false, custom_roles: false,
      activity_log: false, maxBranches: -1, maxEmployees: -1,
      maxServices: -1, maxBookingsPerMonth: -1,
    };

    const enterprise = await runAsSuperAdmin(() =>
      h.prisma.$allTenants.plan.create({
        data: { slug: `DG_ENT_${ts}`, nameAr: 'مؤسسي', nameEn: 'Enterprise',
          priceMonthly: 2000, priceAnnual: 20000, currency: 'SAR',
          limits: { ...baseFeatures, api_access: true, webhooks: true },
          isActive: true, sortOrder: 200 },
        select: { id: true },
      }),
    );
    const basic = await runAsSuperAdmin(() =>
      h.prisma.$allTenants.plan.create({
        data: { slug: `DG_BASIC_${ts}`, nameAr: 'أساسي', nameEn: 'Basic',
          priceMonthly: 300, priceAnnual: 3000, currency: 'SAR',
          limits: { ...baseFeatures, api_access: false, webhooks: false },
          isActive: true, sortOrder: 50 },
        select: { id: true },
      }),
    );
    proPlanId = enterprise.id;
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

    cacheService.invalidate(org.id);
  }, 60_000);

  afterAll(async () => {
    if (!h) return;
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

  it('writes apiAccessGraceUntil and webhooksGraceUntil (~7d) when downgrading away from api_access + webhooks', async () => {
    const before = Date.now();

    await h.runAs({ organizationId: org.id }, () =>
      downgrade.execute({ planId: basicPlanId, billingCycle: 'MONTHLY' }),
    );

    const sub = await runAsSuperAdmin(() =>
      h.prisma.$allTenants.subscription.findFirst({
        where: { organizationId: org.id },
        select: { planId: true, apiAccessGraceUntil: true, webhooksGraceUntil: true },
      }),
    );

    expect(sub?.planId).toBe(basicPlanId);

    // Grace columns must be set and approximately 7 days in the future
    expect(sub?.apiAccessGraceUntil).not.toBeNull();
    expect(sub?.webhooksGraceUntil).not.toBeNull();

    const sevenDaysMs = 7 * 86_400_000;
    const tolerance = 5_000; // 5 second tolerance

    const apiGrace = sub!.apiAccessGraceUntil!.getTime();
    const webhookGrace = sub!.webhooksGraceUntil!.getTime();

    expect(apiGrace).toBeGreaterThanOrEqual(before + sevenDaysMs - tolerance);
    expect(apiGrace).toBeLessThanOrEqual(before + sevenDaysMs + tolerance);
    expect(webhookGrace).toBeGreaterThanOrEqual(before + sevenDaysMs - tolerance);
    expect(webhookGrace).toBeLessThanOrEqual(before + sevenDaysMs + tolerance);
  });
});
