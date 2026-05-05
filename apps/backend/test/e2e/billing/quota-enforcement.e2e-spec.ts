/**
 * Phase 6 / Task 10 — Quota enforcement e2e.
 *
 * Seeds a plan with limits.maxEmployees = 5.
 * Directly inserts 5 employee rows via prisma within tenant CLS context.
 * Verifies FeatureGuard.canActivate() for FeatureKey.EMPLOYEES:
 *   - Throws ForbiddenException when count >= limit (5/5).
 *   - The error message contains the expected feature-limit format.
 *   - Passes when count < limit (4/5 after deleting one employee).
 */
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { bootHarness, IsolationHarness } from '../../tenant-isolation/isolation-harness';
import { FeatureGuard } from '../../../src/modules/platform/billing/feature.guard';
import { SubscriptionCacheService } from '../../../src/modules/platform/billing/subscription-cache.service';
import { REQUIRE_FEATURE_KEY } from '../../../src/modules/platform/billing/feature.decorator';
import { FeatureKey } from '@deqah/shared/constants/feature-keys';
import { UsageCounterService } from '../../../src/modules/platform/billing/usage-counter/usage-counter.service';
import { SUPER_ADMIN_CONTEXT_CLS_KEY } from '../../../src/common/tenant/tenant.constants';
import { EPOCH } from '../../../src/modules/platform/billing/usage-counter/period.util';

describe('Phase 6 / Task 10 — Quota enforcement e2e (maxEmployees)', () => {
  let h: IsolationHarness;
  let guard: FeatureGuard;
  let cacheService: SubscriptionCacheService;
  let counters: UsageCounterService;
  let org: { id: string };
  let customPlanId: string;
  const MAX_EMPLOYEES = 5;
  const ts = Date.now();

  function runAsSuperAdmin<T>(fn: () => Promise<T>): Promise<T> {
    return h.cls.run(() => {
      h.cls.set(SUPER_ADMIN_CONTEXT_CLS_KEY, true);
      return fn();
    });
  }

  beforeAll(async () => {
    process.env.MOYASAR_PLATFORM_SECRET_KEY ??= 'test-platform-secret-key';
    process.env.MOYASAR_PLATFORM_WEBHOOK_SECRET ??= 'test-platform-webhook-secret';

    h = await bootHarness();

    org = await h.createOrg(`quota-enforce-${ts}`, 'منظمة اختبار الحصة');

    // Create a custom plan with maxEmployees = 5
    const plan = await runAsSuperAdmin(() =>
      h.prisma.$allTenants.plan.create({
        data: {
          slug: `TEST_QUOTA_${ts}`,
          nameAr: 'خطة اختبار الحصة',
          nameEn: 'Quota Test Plan',
          priceMonthly: 0,
          priceAnnual: 0,
          currency: 'SAR',
          limits: {
            recurring_bookings: false,
            waitlist: false,
            group_sessions: false,
            ai_chatbot: false,
            email_templates: true,
            coupons: false,
            advanced_reports: false,
            intake_forms: true,
            custom_roles: false,
            activity_log: false,
            maxBranches: -1,
            maxEmployees: MAX_EMPLOYEES,
            maxServices: -1,
            maxBookingsPerMonth: -1,
          },
          isActive: true,
          sortOrder: 999,
        },
        select: { id: true },
      }),
    );
    customPlanId = plan.id;

    const now = new Date();
    await runAsSuperAdmin(() =>
      h.prisma.$allTenants.subscription.create({
        data: {
          organizationId: org.id,
          planId: customPlanId,
          status: 'ACTIVE',
          billingCycle: 'MONTHLY',
          currentPeriodStart: now,
          currentPeriodEnd: new Date(now.getTime() + 30 * 86_400_000),
        },
      }),
    );

    // Seed MAX_EMPLOYEES employees under tenant CLS context
    // Employee.specialty is just a string field — no FK to a Specialty model
    await h.runAs({ organizationId: org.id }, async () => {
      for (let i = 1; i <= MAX_EMPLOYEES; i++) {
        await h.prisma.employee.create({
          data: {
            organizationId: org.id,
            name: `Employee ${i}`,
            nameAr: `موظف ${i}`,
            nameEn: `Employee ${i}`,
            specialty: 'General',
            phone: `0500${ts.toString().slice(-4)}${i}`.slice(0, 10),
          },
        });
      }
    });

    cacheService = h.app.get(SubscriptionCacheService);
    counters = h.app.get(UsageCounterService);

    guard = new FeatureGuard(
      h.app.get(Reflector),
      h.prisma,
      cacheService,
      counters,
    );

    FeatureGuard.invalidate(org.id);
    cacheService.invalidate(org.id);

    // Seed the usage counter to match the actual DB count (uses $allTenants internally)
    await runAsSuperAdmin(() =>
      counters.upsertExact(org.id, FeatureKey.EMPLOYEES, EPOCH, MAX_EMPLOYEES),
    );
  });

  afterAll(async () => {
    if (h) {
      // Delete employees before cleanupOrg (FK constraint)
      await h.runAs({ organizationId: org.id }, async () => {
        await h.prisma.employee.deleteMany({ where: { organizationId: org.id } });
      });
      await runAsSuperAdmin(async () => {
        await h.prisma.$allTenants.subscription.deleteMany({ where: { organizationId: org.id } });
        await h.prisma.$allTenants.usageCounter.deleteMany({ where: { organizationId: org.id } });
      });
      await h.cleanupOrg(org.id);
      await runAsSuperAdmin(() =>
        h.prisma.$allTenants.plan.delete({ where: { id: customPlanId } }),
      );
      await h.close();
    }
  });

  function ctxFor(featureKey: FeatureKey, organizationId: string): ExecutionContext {
    const handler = function () {};
    Reflect.defineMetadata(REQUIRE_FEATURE_KEY, featureKey, handler);
    return {
      getHandler: () => handler,
      getClass: () => class {},
      switchToHttp: () => ({
        getRequest: () => ({ user: { organizationId } }),
      }),
    } as unknown as ExecutionContext;
  }

  /**
   * Run fn with BOTH tenant CLS context AND super-admin CLS context.
   * FeatureGuard.canActivate() needs tenant context (requireOrganizationId) and
   * UsageCounterService needs $allTenants (super-admin context) for quota reads.
   */
  function runAsGuardContext<T>(organizationId: string, fn: () => Promise<T>): Promise<T> {
    return h.cls.run(() => {
      h.cls.set(SUPER_ADMIN_CONTEXT_CLS_KEY, true); // for UsageCounterService.$allTenants
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

  it('FeatureGuard throws ForbiddenException when employee count is at the limit (5/5)', async () => {
    await runAsGuardContext(org.id, async () => {
      await expect(guard.canActivate(ctxFor(FeatureKey.EMPLOYEES, org.id))).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });
  });

  it('ForbiddenException message contains the feature limit format (employees: 5/5)', async () => {
    await runAsGuardContext(org.id, async () => {
      try {
        await guard.canActivate(ctxFor(FeatureKey.EMPLOYEES, org.id));
        throw new Error('Expected ForbiddenException but guard passed');
      } catch (e: unknown) {
        expect(e).toBeInstanceOf(ForbiddenException);
        const err = e as ForbiddenException;
        const msg = err.message;
        expect(msg).toContain('employees');
        expect(msg).toContain(`${MAX_EMPLOYEES}`);
      }
    });
  });

  it('FeatureGuard passes when employee count is below the limit (4/5)', async () => {
    // Delete one employee so count = 4 (use tenant context for scoped reads/writes)
    const lastEmployee = await h.runAs({ organizationId: org.id }, async () =>
      h.prisma.employee.findFirst({
        where: { organizationId: org.id },
        orderBy: { createdAt: 'desc' },
      }),
    );

    if (lastEmployee) {
      await h.runAs({ organizationId: org.id }, async () => {
        await h.prisma.employee.delete({ where: { id: lastEmployee.id } });
      });
    }

    // Update counter to 4 (self-heal path will also recompute if missed)
    await runAsSuperAdmin(() =>
      counters.upsertExact(org.id, FeatureKey.EMPLOYEES, EPOCH, MAX_EMPLOYEES - 1),
    );

    await runAsGuardContext(org.id, async () => {
      const result = await guard.canActivate(ctxFor(FeatureKey.EMPLOYEES, org.id));
      expect(result).toBe(true);
    });
  });
});
