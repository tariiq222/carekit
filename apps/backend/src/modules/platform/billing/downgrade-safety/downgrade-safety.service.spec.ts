import { FeatureKey } from '@deqah/shared/constants/feature-keys';
import { DowngradeSafetyService, BooleanViolation } from './downgrade-safety.service';

const buildPrisma = (counts: { branches?: number; employees?: number; bookings?: number } = {}) => ({
  $allTenants: {
    branch: { count: jest.fn().mockResolvedValue(counts.branches ?? 0) },
    employee: { count: jest.fn().mockResolvedValue(counts.employees ?? 0) },
    booking: { count: jest.fn().mockResolvedValue(counts.bookings ?? 0), findMany: jest.fn().mockResolvedValue([]) },
    waitlistEntry: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]) },
    groupSession: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]) },
    knowledgeDocument: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]) },
    emailTemplate: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]) },
    coupon: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]) },
    intakeForm: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]) },
    customRole: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]) },
    integration: { findFirst: jest.fn().mockResolvedValue(null) },
    payment: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]) },
    department: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]) },
    organizationSmsConfig: { findFirst: jest.fn().mockResolvedValue(null) },
    invoice: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]) },
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
      { kind: 'QUANTITATIVE', featureKey: FeatureKey.EMPLOYEES, current: 12, targetMax: 5 },
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
    const featureKeys = result.violations.map((v) => v.featureKey);
    expect(featureKeys).toContain(FeatureKey.BRANCHES);
    expect(featureKeys).toContain(FeatureKey.EMPLOYEES);
    // bookings are 0 — under target — no violation
    expect(featureKeys).not.toContain(FeatureKey.MONTHLY_BOOKINGS);
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
      kind: 'QUANTITATIVE',
      featureKey: FeatureKey.EMPLOYEES,
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

  describe('boolean checks', () => {
    it('returns BOOLEAN violation when coupons are active and feature is removed', async () => {
      const prisma = {
        $allTenants: {
          branch: { count: jest.fn().mockResolvedValue(1) },
          employee: { count: jest.fn().mockResolvedValue(1) },
          booking: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]) },
          waitlistEntry: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]) },
          groupSession: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]) },
          knowledgeDocument: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]) },
          emailTemplate: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]) },
          coupon: {
            count: jest.fn().mockResolvedValue(3),
            findMany: jest.fn().mockResolvedValue([{ id: 'c1' }, { id: 'c2' }, { id: 'c3' }]),
          },
          intakeForm: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]) },
          customRole: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]) },
          integration: { findFirst: jest.fn().mockResolvedValue(null) },
          payment: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]) },
          department: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]) },
          organizationSmsConfig: { findFirst: jest.fn().mockResolvedValue(null) },
          invoice: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]) },
        },
      };
      const counters = buildCounters({ [FeatureKey.BRANCHES]: 1, [FeatureKey.EMPLOYEES]: 1, [FeatureKey.MONTHLY_BOOKINGS]: 5 });
      const svc = new DowngradeSafetyService(prisma as never, counters as never);

      const result = await svc.checkDowngrade(
        planWith({ maxBranches: 5, maxEmployees: 10, maxBookingsPerMonth: 100, coupons: true }),
        planWith({ maxBranches: 2, maxEmployees: 5, maxBookingsPerMonth: 50, coupons: false }),
        'org-A',
      );

      expect(result.ok).toBe(false);
      const boolViolation = result.violations.find(v => v.kind === 'BOOLEAN') as BooleanViolation | undefined;
      expect(boolViolation).toBeDefined();
      expect(boolViolation?.featureKey).toBe(FeatureKey.COUPONS);
      expect(boolViolation?.blockingResources.count).toBe(3);
    });

    it('returns no BOOLEAN violation when feature stays on in target plan', async () => {
      const prisma = {
        $allTenants: {
          branch: { count: jest.fn().mockResolvedValue(1) },
          employee: { count: jest.fn().mockResolvedValue(1) },
          booking: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]) },
          waitlistEntry: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]) },
          groupSession: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]) },
          knowledgeDocument: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]) },
          emailTemplate: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]) },
          coupon: { count: jest.fn().mockResolvedValue(5), findMany: jest.fn().mockResolvedValue([{ id: 'c1' }]) },
          intakeForm: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]) },
          customRole: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]) },
          integration: { findFirst: jest.fn().mockResolvedValue(null) },
          payment: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]) },
          department: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]) },
          organizationSmsConfig: { findFirst: jest.fn().mockResolvedValue(null) },
          invoice: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]) },
        },
      };
      const counters = buildCounters({ [FeatureKey.BRANCHES]: 1, [FeatureKey.EMPLOYEES]: 1, [FeatureKey.MONTHLY_BOOKINGS]: 5 });
      const svc = new DowngradeSafetyService(prisma as never, counters as never);

      // coupons: true in BOTH current and target — no boolean violation
      const result = await svc.checkDowngrade(
        planWith({ maxBranches: 5, maxEmployees: 10, maxBookingsPerMonth: 100, coupons: true }),
        planWith({ maxBranches: 2, maxEmployees: 5, maxBookingsPerMonth: 50, coupons: true }),
        'org-A',
      );

      const boolViolation = result.violations.find(v => v.kind === 'BOOLEAN');
      expect(boolViolation).toBeUndefined();
    });
  });
});
