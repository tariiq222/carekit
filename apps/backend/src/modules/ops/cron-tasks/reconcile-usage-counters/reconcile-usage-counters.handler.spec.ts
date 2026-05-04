import { FeatureKey } from '@deqah/shared/constants/feature-keys';
import { SUPER_ADMIN_CONTEXT_CLS_KEY } from '../../../../common/tenant/tenant.constants';
import { ReconcileUsageCountersHandler } from './reconcile-usage-counters.handler';

const buildPrisma = () => ({
  $allTenants: {
    organization: {
      findMany: jest.fn(),
    },
  },
  branch: { count: jest.fn() },
  employee: { count: jest.fn() },
  service: { count: jest.fn() },
  booking: { count: jest.fn() },
});

const buildCounters = () => ({
  read: jest.fn(),
  upsertExact: jest.fn().mockResolvedValue(undefined),
});

/**
 * Mock ClsService whose cls.run() calls the callback synchronously
 * (same tick) with the mocked CLS store. cls.set() is a no-op since
 * the tenant-scoping extension is not loaded in unit tests.
 */
const buildCls = () => ({
  run: jest.fn(async (cb: () => Promise<unknown>) => cb()),
  set: jest.fn(),
});

describe('ReconcileUsageCountersHandler', () => {
  it('returns zero repairs when counters match reality', async () => {
    const prisma = buildPrisma();
    const counters = buildCounters();
    const cls = buildCls();

    prisma.$allTenants.organization.findMany.mockResolvedValue([{ id: 'org-1' }]);
    // Source counts: 3 for all keyed types
    prisma.branch.count.mockResolvedValue(3);
    prisma.employee.count.mockResolvedValue(3);
    prisma.service.count.mockResolvedValue(3);
    prisma.booking.count.mockResolvedValue(3);

    // Counter reads match reality — no drift
    counters.read.mockResolvedValue(3);

    const handler = new ReconcileUsageCountersHandler(
      prisma as never,
      counters as never,
      cls as never,
    );

    const result = await handler.execute();
    expect(result.orgsScanned).toBe(1);
    expect(result.rowsRepaired).toBe(0);
    expect(counters.upsertExact).not.toHaveBeenCalled();
  });

  it('repairs drifted monthly_bookings counter', async () => {
    const prisma = buildPrisma();
    const counters = buildCounters();
    const cls = buildCls();

    prisma.$allTenants.organization.findMany.mockResolvedValue([{ id: 'org-1' }]);
    // Source: branches=1, employees=1, services=1, bookings=7
    prisma.branch.count.mockResolvedValue(1);
    prisma.employee.count.mockResolvedValue(1);
    prisma.service.count.mockResolvedValue(1);
    prisma.booking.count.mockResolvedValue(7);

    counters.read.mockImplementation((_org: string, key: FeatureKey) => {
      // Drift only on monthly_bookings (stored=5, truth=7)
      if (key === FeatureKey.MONTHLY_BOOKINGS) return Promise.resolve(5);
      // All others match
      return Promise.resolve(1);
    });

    const handler = new ReconcileUsageCountersHandler(
      prisma as never,
      counters as never,
      cls as never,
    );

    const result = await handler.execute();
    expect(result.orgsScanned).toBe(1);
    expect(result.rowsRepaired).toBe(1);
    expect(counters.upsertExact).toHaveBeenCalledWith(
      'org-1',
      FeatureKey.MONTHLY_BOOKINGS,
      expect.any(Date),
      7,
    );
  });

  it('handles missing counter (null stored) by upsert', async () => {
    const prisma = buildPrisma();
    const counters = buildCounters();
    const cls = buildCls();

    prisma.$allTenants.organization.findMany.mockResolvedValue([{ id: 'org-2' }]);
    prisma.branch.count.mockResolvedValue(2);
    prisma.employee.count.mockResolvedValue(4);
    prisma.service.count.mockResolvedValue(0);
    prisma.booking.count.mockResolvedValue(0);

    counters.read.mockResolvedValue(null); // no rows yet

    const handler = new ReconcileUsageCountersHandler(
      prisma as never,
      counters as never,
      cls as never,
    );

    const result = await handler.execute();
    // null !== truth for all 4 keys → 4 repairs
    expect(result.rowsRepaired).toBe(4);
    expect(counters.upsertExact).toHaveBeenCalledWith('org-2', FeatureKey.BRANCHES, expect.any(Date), 2);
    expect(counters.upsertExact).toHaveBeenCalledWith('org-2', FeatureKey.EMPLOYEES, expect.any(Date), 4);
  });

  it('wraps execute body in outer super-admin CLS context', async () => {
    const prisma = buildPrisma();
    const counters = buildCounters();
    const cls = buildCls();

    prisma.$allTenants.organization.findMany.mockResolvedValue([]);
    counters.read.mockResolvedValue(0);

    const handler = new ReconcileUsageCountersHandler(
      prisma as never,
      counters as never,
      cls as never,
    );

    await handler.execute();

    // The outer cls.run call must set SUPER_ADMIN_CONTEXT_CLS_KEY
    expect(cls.run).toHaveBeenCalled();
    expect(cls.set).toHaveBeenCalledWith(SUPER_ADMIN_CONTEXT_CLS_KEY, true);
  });
});
