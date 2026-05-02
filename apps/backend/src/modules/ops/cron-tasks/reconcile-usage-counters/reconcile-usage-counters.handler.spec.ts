import { FeatureKey } from '@deqah/shared/constants/feature-keys';
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
  file: { aggregate: jest.fn() },
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
    // Storage: 3 MB exactly
    prisma.file.aggregate.mockResolvedValue({ _sum: { size: 3 * 1024 * 1024 } });

    // Counter reads match reality — no drift
    counters.read.mockImplementation((_org: string, key: FeatureKey) => {
      if (key === FeatureKey.STORAGE) return Promise.resolve(3);
      return Promise.resolve(3);
    });

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
    // Source: branches=1, employees=1, services=1, bookings=7, storage=1MB
    prisma.branch.count.mockResolvedValue(1);
    prisma.employee.count.mockResolvedValue(1);
    prisma.service.count.mockResolvedValue(1);
    prisma.booking.count.mockResolvedValue(7);
    prisma.file.aggregate.mockResolvedValue({ _sum: { size: 1024 * 1024 } }); // 1 MB

    counters.read.mockImplementation((_org: string, key: FeatureKey) => {
      // Drift only on monthly_bookings (stored=5, truth=7)
      if (key === FeatureKey.MONTHLY_BOOKINGS) return Promise.resolve(5);
      // All others match
      if (key === FeatureKey.STORAGE) return Promise.resolve(1);
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
    prisma.file.aggregate.mockResolvedValue({ _sum: { size: 1024 * 1024 * 10 } }); // 10 MB

    counters.read.mockResolvedValue(null); // no rows yet

    const handler = new ReconcileUsageCountersHandler(
      prisma as never,
      counters as never,
      cls as never,
    );

    const result = await handler.execute();
    // null !== truth for all 5 keys → 5 repairs
    expect(result.rowsRepaired).toBe(5);
    expect(counters.upsertExact).toHaveBeenCalledWith('org-2', FeatureKey.STORAGE, expect.any(Date), 10);
  });
});
