import { GetUsageHandler } from './get-usage.handler';
import { FeatureKey } from '@deqah/shared/constants/feature-keys';
import { SubscriptionCacheService } from '../subscription-cache.service';
import { UsageCounterService } from '../usage-counter/usage-counter.service';
import { TenantContextService } from '../../../../common/tenant/tenant-context.service';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';

const ORG_ID = 'org-usage-test';

function buildCache(limits: Record<string, number | boolean> = {}) {
  return {
    get: jest.fn().mockResolvedValue(
      Object.keys(limits).length > 0
        ? { planSlug: 'PRO', status: 'ACTIVE', limits, expiresAt: Date.now() + 60_000 }
        : null,
    ),
  } as unknown as SubscriptionCacheService;
}

function buildCounters(value: number | null = null) {
  return {
    read: jest.fn().mockResolvedValue(value),
    upsertExact: jest.fn().mockResolvedValue(undefined),
    increment: jest.fn().mockResolvedValue(undefined),
  } as unknown as UsageCounterService;
}

function buildTenant() {
  return {
    requireOrganizationId: jest.fn().mockReturnValue(ORG_ID),
  } as unknown as TenantContextService;
}

function buildPrisma(overrides: Partial<Record<string, number>> = {}) {
  return {
    branch: { count: jest.fn().mockResolvedValue(overrides.branches ?? 0) },
    employee: { count: jest.fn().mockResolvedValue(overrides.employees ?? 0) },
    service: { count: jest.fn().mockResolvedValue(overrides.services ?? 0) },
    booking: { count: jest.fn().mockResolvedValue(overrides.bookings ?? 0) },
  } as unknown as PrismaService;
}

const PRO_LIMITS = {
  maxBranches: 3,
  maxEmployees: 20,
  maxServices: 50,
  maxBookingsPerMonth: 500,
};

describe('GetUsageHandler', () => {
  it('returns 4 rows, one per quantitative feature key', async () => {
    const handler = new GetUsageHandler(
      buildTenant(),
      buildCache(PRO_LIMITS),
      buildCounters(0),
      buildPrisma(),
    );

    const rows = await handler.execute({ organizationId: ORG_ID });
    expect(rows).toHaveLength(4);
    const keys = rows.map((r) => r.featureKey);
    expect(keys).toContain(FeatureKey.BRANCHES);
    expect(keys).toContain(FeatureKey.EMPLOYEES);
    expect(keys).toContain(FeatureKey.SERVICES);
    expect(keys).toContain(FeatureKey.MONTHLY_BOOKINGS);
  });

  it('unlimited limit (-1) returns 0% and correct limit', async () => {
    const limits = { ...PRO_LIMITS, maxBranches: -1 };
    const handler = new GetUsageHandler(
      buildTenant(),
      buildCache(limits),
      buildCounters(5),
      buildPrisma(),
    );

    const rows = await handler.execute({ organizationId: ORG_ID });
    const branch = rows.find((r) => r.featureKey === FeatureKey.BRANCHES)!;
    expect(branch.limit).toBe(-1);
    expect(branch.percentage).toBe(0);
  });

  it('over-limit usage is capped at 100%', async () => {
    const limits = { ...PRO_LIMITS, maxEmployees: 5 };
    const handler = new GetUsageHandler(
      buildTenant(),
      buildCache(limits),
      buildCounters(10), // 10 employees, limit 5 → 200% → capped at 100
      buildPrisma(),
    );

    const rows = await handler.execute({ organizationId: ORG_ID });
    const emp = rows.find((r) => r.featureKey === FeatureKey.EMPLOYEES)!;
    expect(emp.percentage).toBe(100);
  });

  it('counter miss triggers fallback count() once and calls upsertExact (self-heal)', async () => {
    const counters = buildCounters(null); // cache miss
    const prisma = buildPrisma({ employees: 7 });

    const handler = new GetUsageHandler(
      buildTenant(),
      buildCache(PRO_LIMITS),
      counters,
      prisma,
    );

    const rows = await handler.execute({ organizationId: ORG_ID });
    const emp = rows.find((r) => r.featureKey === FeatureKey.EMPLOYEES)!;

    expect(emp.current).toBe(7);
    expect(counters.upsertExact).toHaveBeenCalledWith(
      ORG_ID,
      FeatureKey.EMPLOYEES,
      expect.any(Date),
      7,
    );
  });

  it('MONTHLY_BOOKINGS has a non-null periodEnd', async () => {
    const handler = new GetUsageHandler(
      buildTenant(),
      buildCache(PRO_LIMITS),
      buildCounters(10),
      buildPrisma(),
    );

    const rows = await handler.execute({ organizationId: ORG_ID });
    const bookings = rows.find((r) => r.featureKey === FeatureKey.MONTHLY_BOOKINGS)!;
    expect(bookings.periodEnd).toBeInstanceOf(Date);
  });

  it('EMPLOYEES has null periodEnd (lifetime counter)', async () => {
    const handler = new GetUsageHandler(
      buildTenant(),
      buildCache(PRO_LIMITS),
      buildCounters(3),
      buildPrisma(),
    );

    const rows = await handler.execute({ organizationId: ORG_ID });
    const emp = rows.find((r) => r.featureKey === FeatureKey.EMPLOYEES)!;
    expect(emp.periodEnd).toBeNull();
  });
});
