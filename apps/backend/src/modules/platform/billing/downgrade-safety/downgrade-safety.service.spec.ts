import { FeatureKey } from '@deqah/shared/constants/feature-keys';
import { DowngradeSafetyService } from './downgrade-safety.service';

const buildPrisma = (counts: { branches?: number; employees?: number; bookings?: number } = {}) => ({
  $allTenants: {
    branch: { count: jest.fn().mockResolvedValue(counts.branches ?? 0) },
    employee: { count: jest.fn().mockResolvedValue(counts.employees ?? 0) },
    booking: { count: jest.fn().mockResolvedValue(counts.bookings ?? 0) },
  },
});

const buildCounters = (
  values: Partial<Record<string, number | null>> = {},
) => ({
  read: jest.fn().mockImplementation(async (_orgId: string, key: string) => {
    if (key in values) return values[key] ?? null;
    return null;
  }),
});

const buildService = (
  prisma: ReturnType<typeof buildPrisma>,
  counters: ReturnType<typeof buildCounters>,
) => new DowngradeSafetyService(prisma as never, counters as never);

const planWith = (limits: Record<string, number | boolean>) => ({ limits });

describe('DowngradeSafetyService', () => {
  it('ok when usage below target limits', async () => {
    const prisma = buildPrisma();
    const counters = buildCounters({
      [FeatureKey.BRANCHES]: 1,
      [FeatureKey.EMPLOYEES]: 3,
      [FeatureKey.MONTHLY_BOOKINGS]: 10,
    });
    const svc = buildService(prisma, counters);

    const result = await svc.checkDowngrade(
      planWith({ maxBranches: 5, maxEmployees: 10, maxBookingsPerMonth: 100 }),
      planWith({ maxBranches: 2, maxEmployees: 5, maxBookingsPerMonth: 50 }),
      'org-A',
    );

    expect(result.ok).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it('violations listed when employees > target maxEmployees', async () => {
    const prisma = buildPrisma();
    const counters = buildCounters({
      [FeatureKey.BRANCHES]: 1,
      [FeatureKey.EMPLOYEES]: 12,
      [FeatureKey.MONTHLY_BOOKINGS]: 10,
    });
    const svc = buildService(prisma, counters);

    const result = await svc.checkDowngrade(
      planWith({ maxBranches: 5, maxEmployees: 20, maxBookingsPerMonth: 1000 }),
      planWith({ maxBranches: 2, maxEmployees: 5, maxBookingsPerMonth: 100 }),
      'org-A',
    );

    expect(result.ok).toBe(false);
    expect(result.violations).toEqual([
      { kind: FeatureKey.EMPLOYEES, current: 12, targetMax: 5 },
    ]);
  });

  it('unlimited current plan + finite target plan with violations works', async () => {
    const prisma = buildPrisma();
    const counters = buildCounters({
      [FeatureKey.BRANCHES]: 8,
      [FeatureKey.EMPLOYEES]: 50,
      [FeatureKey.MONTHLY_BOOKINGS]: 0,
    });
    const svc = buildService(prisma, counters);

    const result = await svc.checkDowngrade(
      planWith({ maxBranches: -1, maxEmployees: -1, maxBookingsPerMonth: -1 }),
      planWith({ maxBranches: 3, maxEmployees: 10, maxBookingsPerMonth: 100 }),
      'org-A',
    );

    expect(result.ok).toBe(false);
    const kinds = result.violations.map((v) => v.kind);
    expect(kinds).toContain(FeatureKey.BRANCHES);
    expect(kinds).toContain(FeatureKey.EMPLOYEES);
    // bookings are 0 — under target — no violation
    expect(kinds).not.toContain(FeatureKey.MONTHLY_BOOKINGS);
  });

  it('unlimited target plan never violates', async () => {
    const prisma = buildPrisma();
    const counters = buildCounters({
      [FeatureKey.BRANCHES]: 999,
      [FeatureKey.EMPLOYEES]: 999,
      [FeatureKey.MONTHLY_BOOKINGS]: 999,
    });
    const svc = buildService(prisma, counters);

    const result = await svc.checkDowngrade(
      planWith({ maxBranches: 100, maxEmployees: 100, maxBookingsPerMonth: 100 }),
      planWith({ maxBranches: -1, maxEmployees: -1, maxBookingsPerMonth: -1 }),
      'org-A',
    );

    expect(result.ok).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it('falls back to live count when usage counter row is missing', async () => {
    const prisma = buildPrisma({ employees: 8 });
    // No counter rows pre-populated → null → recomputeFromSource is hit.
    const counters = buildCounters();
    const svc = buildService(prisma, counters);

    const result = await svc.checkDowngrade(
      planWith({ maxEmployees: 10 }),
      planWith({ maxEmployees: 5 }),
      'org-A',
    );

    expect(prisma.$allTenants.employee.count).toHaveBeenCalled();
    expect(result.ok).toBe(false);
    expect(result.violations[0]).toEqual({
      kind: FeatureKey.EMPLOYEES,
      current: 8,
      targetMax: 5,
    });
  });

  it('recomputes employees with isActive=true filter', async () => {
    const prisma = buildPrisma({ employees: 3 });
    const counters = buildCounters(); // no row → triggers fallback
    const svc = buildService(prisma, counters);

    await svc.checkDowngrade(
      planWith({ maxEmployees: 10 }),
      planWith({ maxEmployees: 5 }),
      'org-B',
    );

    expect(prisma.$allTenants.employee.count).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ isActive: true }) }),
    );
  });
});
