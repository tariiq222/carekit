/**
 * Phase 5 / Task 5.4 — Custom domain grace cron e2e
 *
 * Verifies:
 * 1. Downgrading away from custom_domain sets customDomainGraceUntil (~30d).
 * 2. CustomDomainGraceCron sends warning email when daysLeft ≤ 7.
 * 3. CustomDomainGraceCron reverts (nulls) customDomainGraceUntil + sends
 *    expiry email when daysLeft ≤ 0.
 *
 * Uses real Date manipulation by temporarily overwriting OrganizationSettings
 * with a past/near-past grace date, then calling cron.run() with BILLING_CRON_ENABLED=true.
 */
import { bootHarness, IsolationHarness } from '../../tenant-isolation/isolation-harness';
import { DowngradePlanHandler } from '../../../src/modules/platform/billing/downgrade-plan/downgrade-plan.handler';
import { CustomDomainGraceCron } from '../../../src/modules/platform/billing/grace-watchers/custom-domain-grace.cron';
import { PlatformMailerService } from '../../../src/infrastructure/mail';
import { SubscriptionCacheService } from '../../../src/modules/platform/billing/subscription-cache.service';
import { SUPER_ADMIN_CONTEXT_CLS_KEY } from '../../../src/common/tenant/tenant.constants';

describe('Phase 5 / Task 5.4 — Custom domain grace cron e2e', () => {
  let h: IsolationHarness;
  let downgrade: DowngradePlanHandler;
  let cron: CustomDomainGraceCron;
  let mailer: jest.Mocked<PlatformMailerService>;
  let cacheService: SubscriptionCacheService;
  let org: { id: string };
  let enterprisePlanId: string;
  let basicPlanId: string;
  let userId: string;
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
    cron = h.app.get(CustomDomainGraceCron);
    mailer = h.app.get(PlatformMailerService) as jest.Mocked<PlatformMailerService>;
    cacheService = h.app.get(SubscriptionCacheService);

    org = await h.createOrg(`dg-domain-${ts}`, 'منظمة نطاق مخصص');

    const baseFeatures = {
      recurring_bookings: false, waitlist: false, group_sessions: false,
      ai_chatbot: false, email_templates: false, coupons: false,
      advanced_reports: false, intake_forms: false, custom_roles: false,
      activity_log: false, maxBranches: -1, maxEmployees: -1,
      maxServices: -1, maxBookingsPerMonth: -1,
    };

    const enterprise = await runAsSuperAdmin(() =>
      h.prisma.$allTenants.plan.create({
        data: { slug: `DDOM_ENT_${ts}`, nameAr: 'مؤسسي', nameEn: 'Enterprise',
          priceMonthly: 2000, priceAnnual: 20000, currency: 'SAR',
          limits: { ...baseFeatures, custom_domain: true }, isActive: true, sortOrder: 200 },
        select: { id: true },
      }),
    );
    const basic = await runAsSuperAdmin(() =>
      h.prisma.$allTenants.plan.create({
        data: { slug: `DDOM_BASIC_${ts}`, nameAr: 'أساسي', nameEn: 'Basic',
          priceMonthly: 300, priceAnnual: 3000, currency: 'SAR',
          limits: { ...baseFeatures, custom_domain: false }, isActive: true, sortOrder: 50 },
        select: { id: true },
      }),
    );
    enterprisePlanId = enterprise.id;
    basicPlanId = basic.id;

    const now = new Date();
    await runAsSuperAdmin(() =>
      h.prisma.$allTenants.subscription.create({
        data: {
          organizationId: org.id, planId: enterprisePlanId, status: 'ACTIVE',
          billingCycle: 'MONTHLY', currentPeriodStart: now,
          currentPeriodEnd: new Date(now.getTime() + 30 * 86_400_000),
        },
      }),
    );

    // Create a user + OWNER membership so cron can find the owner
    const user = await h.prisma.user.create({
      data: { email: `owner-domain-${ts}@test.com`, name: 'Domain Owner',
        passwordHash: 'x', phone: `0501${ts.toString().slice(-6)}` },
      select: { id: true },
    });
    userId = user.id;

    await h.runAs({ organizationId: org.id }, () =>
      h.prisma.membership.create({
        data: { organizationId: org.id, userId: user.id, role: 'OWNER', isActive: true },
      }),
    );

    // Ensure OrganizationSettings row exists
    await h.prisma.$allTenants.organizationSettings.upsert({
      where: { organizationId: org.id },
      update: {},
      create: { organizationId: org.id },
    });

    cacheService.invalidate(org.id);
  }, 60_000);

  afterAll(async () => {
    if (!h) return;
    await h.runAs({ organizationId: org.id }, async () => {
      await h.prisma.membership.deleteMany({ where: { organizationId: org.id } });
    });
    await h.prisma.user.delete({ where: { id: userId } }).catch(() => undefined);
    await runAsSuperAdmin(async () => {
      await h.prisma.$allTenants.subscription.deleteMany({ where: { organizationId: org.id } });
      await h.prisma.$allTenants.organizationSettings.deleteMany({ where: { organizationId: org.id } });
    });
    await h.cleanupOrg(org.id);
    await runAsSuperAdmin(async () => {
      await h.prisma.$allTenants.plan.delete({ where: { id: basicPlanId } });
      await h.prisma.$allTenants.plan.delete({ where: { id: enterprisePlanId } });
    });
    await h.close();
  });

  it('sets customDomainGraceUntil ~30 days on downgrade', async () => {
    const before = Date.now();

    await h.runAs({ organizationId: org.id }, () =>
      downgrade.execute({ planId: basicPlanId, billingCycle: 'MONTHLY' }),
    );

    const settings = await h.prisma.$allTenants.organizationSettings.findFirst({
      where: { organizationId: org.id },
      select: { customDomainGraceUntil: true },
    });

    expect(settings?.customDomainGraceUntil).not.toBeNull();
    const thirtyDaysMs = 30 * 86_400_000;
    const grace = settings!.customDomainGraceUntil!.getTime();
    expect(grace).toBeGreaterThan(before + thirtyDaysMs - 5_000);
    expect(grace).toBeLessThan(before + thirtyDaysMs + 5_000);
  });

  it('cron sends warning email when ≤7 days remain', async () => {
    // Set grace date to 3 days from now (within warning window)
    await h.prisma.$allTenants.organizationSettings.update({
      where: { organizationId: org.id },
      data: { customDomainGraceUntil: new Date(Date.now() + 3 * 86_400_000) },
    });

    // Mock mailer method
    const warnSpy = jest.spyOn(mailer, 'sendFeatureGraceWarning').mockResolvedValue(undefined);

    process.env.BILLING_CRON_ENABLED = 'true';
    await cron.run();
    process.env.BILLING_CRON_ENABLED = 'false';

    expect(warnSpy).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ featureKey: 'custom_domain', daysLeft: expect.any(Number) }),
    );

    warnSpy.mockRestore();
  });

  it('cron reverts customDomainGraceUntil and sends expiry email when grace has passed', async () => {
    // Set grace date in the past (grace expired)
    await h.prisma.$allTenants.organizationSettings.update({
      where: { organizationId: org.id },
      data: { customDomainGraceUntil: new Date(Date.now() - 86_400_000) },
    });

    const expirySpy = jest.spyOn(mailer, 'sendFeatureGraceExpired').mockResolvedValue(undefined);

    process.env.BILLING_CRON_ENABLED = 'true';
    await cron.run();
    process.env.BILLING_CRON_ENABLED = 'false';

    expect(expirySpy).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ featureKey: 'custom_domain' }),
    );

    // Grace column should be null (reverted)
    const settings = await h.prisma.$allTenants.organizationSettings.findFirst({
      where: { organizationId: org.id },
      select: { customDomainGraceUntil: true },
    });
    expect(settings?.customDomainGraceUntil).toBeNull();

    expirySpy.mockRestore();
  });
});
