import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { bootHarness, IsolationHarness } from '../../tenant-isolation/isolation-harness';
import { PlanLimitsGuard } from '../../../src/modules/platform/billing/enforce-limits.guard';
import { SubscriptionCacheService } from '../../../src/modules/platform/billing/subscription-cache.service';
import { ENFORCE_LIMIT_KEY, LimitKind } from '../../../src/modules/platform/billing/plan-limits.decorator';

/**
 * SaaS-04 Task 14B — PlanLimitsGuard enforcement e2e.
 *
 * Seeds real Subscription + Plan rows in Postgres, then invokes
 * PlanLimitsGuard.canActivate() directly under CLS tenant context. Verifies:
 * 1. BASIC plan (maxBranches=1) blocks the 2nd active branch.
 * 2. ENTERPRISE plan (maxBranches=-1, unlimited) allows many.
 * 3. SUSPENDED subscription blocks any enforced create.
 * 4. No subscription row → guard is permissive (dev/trial-before-billing).
 */
describe('SaaS-04 — PlanLimitsGuard enforcement', () => {
  let h: IsolationHarness;

  let BASIC_PLAN_ID: string;
  let ENTERPRISE_PLAN_ID: string;
  let guard: PlanLimitsGuard;

  beforeAll(async () => {
    process.env.MOYASAR_PLATFORM_SECRET_KEY ??= 'test-platform-secret-key';
    process.env.MOYASAR_PLATFORM_WEBHOOK_SECRET ??= 'test-platform-webhook-secret';
    h = await bootHarness();
    const plans = await h.prisma.plan.findMany({ where: { slug: { in: ['BASIC', 'ENTERPRISE'] } } });
    BASIC_PLAN_ID = plans.find((p) => p.slug === 'BASIC')!.id;
    ENTERPRISE_PLAN_ID = plans.find((p) => p.slug === 'ENTERPRISE')!.id;
    // PlanLimitsGuard is registered as APP_GUARD only — Nest doesn't expose it
    // via `app.get(PlanLimitsGuard)`. Construct it manually with injected deps.
    guard = new PlanLimitsGuard(
      h.app.get(Reflector),
      h.prisma,
      h.app.get(SubscriptionCacheService),
    );
  });

  afterAll(async () => {
    if (h) await h.close();
  });

  function ctxFor(kind: LimitKind, organizationId: string): ExecutionContext {
    const handler = function () {}; // marker fn — reflector attaches metadata by reference
    Reflect.defineMetadata(ENFORCE_LIMIT_KEY, kind, handler);
    return {
      getHandler: () => handler,
      getClass: () => class {},
      switchToHttp: () => ({
        getRequest: () => ({ user: { organizationId } }),
      }),
    } as unknown as ExecutionContext;
  }

  async function seedActiveSubscription(organizationId: string, planId: string, status: 'ACTIVE' | 'SUSPENDED' = 'ACTIVE') {
    const now = new Date();
    await h.prisma.subscription.create({
      data: {
        organizationId,
        planId,
        status,
        billingCycle: 'MONTHLY',
        currentPeriodStart: now,
        currentPeriodEnd: new Date(now.getTime() + 30 * 86_400_000),
      },
    });
  }

  async function seedBranch(organizationId: string, label: string) {
    await h.prisma.branch.create({
      data: {
        organizationId,
        nameAr: `فرع ${label}`,
        nameEn: `Branch ${label}`,
        phone: '+966500000000',
        isActive: true,
      },
    });
  }

  it('BASIC plan allows the 1st branch create, blocks the 2nd', async () => {
    const ts = Date.now();
    const org = await h.createOrg(`lim-basic-${ts}`, 'منظمة الأساس');
    await seedActiveSubscription(org.id, BASIC_PLAN_ID, 'ACTIVE');

    const cache = h.app.get(SubscriptionCacheService);
    cache.invalidate(org.id);

    // 1st branch — usage count = 0, limit = 1 → allow
    await h.runAs({ organizationId: org.id }, async () => {
      expect(await guard.canActivate(ctxFor('BRANCHES', org.id))).toBe(true);
      await seedBranch(org.id, `br-basic-1-${ts}`);
    });

    // 2nd — usage = 1, limit = 1 → reject
    await expect(
      h.runAs({ organizationId: org.id }, () => guard.canActivate(ctxFor('BRANCHES', org.id))),
    ).rejects.toThrow(ForbiddenException);
  });

  it('ENTERPRISE plan allows unlimited branches (20 creates all pass)', async () => {
    const ts = Date.now();
    const org = await h.createOrg(`lim-ent-${ts}`, 'منظمة مؤسسية');
    await seedActiveSubscription(org.id, ENTERPRISE_PLAN_ID, 'ACTIVE');

    const cache = h.app.get(SubscriptionCacheService);
    cache.invalidate(org.id);

    for (let i = 0; i < 20; i++) {
      await h.runAs({ organizationId: org.id }, async () => {
        expect(await guard.canActivate(ctxFor('BRANCHES', org.id))).toBe(true);
        await seedBranch(org.id, `br-ent-${ts}-${i}`);
      });
    }
  });

  it('SUSPENDED subscription blocks any enforced create (branches, employees)', async () => {
    const ts = Date.now();
    const org = await h.createOrg(`lim-susp-${ts}`, 'منظمة موقوفة');
    await seedActiveSubscription(org.id, BASIC_PLAN_ID, 'SUSPENDED');

    const cache = h.app.get(SubscriptionCacheService);
    cache.invalidate(org.id);

    await expect(
      h.runAs({ organizationId: org.id }, () => guard.canActivate(ctxFor('BRANCHES', org.id))),
    ).rejects.toThrow(/SUSPENDED/);

    await expect(
      h.runAs({ organizationId: org.id }, () => guard.canActivate(ctxFor('EMPLOYEES', org.id))),
    ).rejects.toThrow(/SUSPENDED/);
  });

  it('org without any subscription passes the guard (permissive pre-billing)', async () => {
    const ts = Date.now();
    const org = await h.createOrg(`lim-nosub-${ts}`, 'منظمة بلا اشتراك');

    const cache = h.app.get(SubscriptionCacheService);
    cache.invalidate(org.id);

    await h.runAs({ organizationId: org.id }, async () => {
      expect(await guard.canActivate(ctxFor('BRANCHES', org.id))).toBe(true);
      expect(await guard.canActivate(ctxFor('EMPLOYEES', org.id))).toBe(true);
    });
  });
});
