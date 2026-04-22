import { ComputeOverageCron } from './compute-overage.cron';

const buildPrisma = (record: unknown = null) => ({
  usageRecord: {
    findFirst: jest.fn().mockResolvedValue(record),
  },
});

const STARTER_LIMITS: Record<string, number | boolean> = {
  maxBookingsPerMonth: 500,
  maxClients: 200,
  maxStorageMB: 5120, // 5 GB
  overageRateBookings: 0.5,
  overageRateClients: 2,
  overageRateStorageGB: 5,
};

const ENTERPRISE_LIMITS: Record<string, number | boolean> = {
  maxBookingsPerMonth: -1, // unlimited
  maxClients: -1,
  maxStorageMB: 102400, // 100 GB
  overageRateBookings: 0,
  overageRateClients: 0,
  overageRateStorageGB: 5,
};

const BASE_PARAMS = {
  subscriptionId: 'sub-1',
  organizationId: 'org-1',
  periodStart: new Date('2026-04-01'),
};

describe('ComputeOverageCron', () => {
  it('returns 0 overage when all metrics under quota', async () => {
    const prisma = buildPrisma({ count: 100 }); // under 500
    prisma.usageRecord.findFirst = jest.fn()
      .mockResolvedValueOnce({ count: 100 }) // BOOKINGS
      .mockResolvedValueOnce({ count: 50 })  // CLIENTS
      .mockResolvedValueOnce({ count: 1024 }); // STORAGE_MB (1 GB, under 5 GB)

    const cron = new ComputeOverageCron(prisma as never);
    const result = await cron.computeForSubscription({ ...BASE_PARAMS, limits: STARTER_LIMITS });

    expect(result.lines).toHaveLength(0);
    expect(result.totalOverage).toBe(0);
  });

  it('charges 0.50 SAR per booking above maxBookingsPerMonth: used=612, included=500 → overage=112 → 56 SAR', async () => {
    const prisma = buildPrisma();
    prisma.usageRecord.findFirst = jest.fn()
      .mockResolvedValueOnce({ count: 612 }) // BOOKINGS — over limit
      .mockResolvedValueOnce({ count: 50 })  // CLIENTS — under
      .mockResolvedValueOnce({ count: 512 }); // STORAGE_MB — under 5 GB

    const cron = new ComputeOverageCron(prisma as never);
    const result = await cron.computeForSubscription({ ...BASE_PARAMS, limits: STARTER_LIMITS });

    expect(result.lines).toHaveLength(1);
    expect(result.lines[0]).toMatchObject({
      metric: 'BOOKINGS_PER_MONTH',
      included: 500,
      used: 612,
      overage: 112,
      rate: 0.5,
      amount: 56,
    });
    expect(result.totalOverage).toBe(56);
  });

  it('returns 0 overage for Enterprise bookings (-1 = unlimited)', async () => {
    const prisma = buildPrisma();
    // Only STORAGE_MB will be queried (bookings + clients are unlimited)
    prisma.usageRecord.findFirst = jest.fn().mockResolvedValue({ count: 50000 }); // 50 GB — under 100 GB

    const cron = new ComputeOverageCron(prisma as never);
    const result = await cron.computeForSubscription({ ...BASE_PARAMS, limits: ENTERPRISE_LIMITS });

    // No overage for bookings (unlimited), clients (unlimited), storage (50 GB < 100 GB)
    expect(result.lines).toHaveLength(0);
    expect(result.totalOverage).toBe(0);
  });

  it('Enterprise still charges STORAGE_MB overage above 100GB at 5 SAR/GB', async () => {
    const prisma = buildPrisma();
    // Only STORAGE_MB will be queried for Enterprise
    prisma.usageRecord.findFirst = jest.fn().mockResolvedValue({ count: 153600 }); // 150 GB

    const cron = new ComputeOverageCron(prisma as never);
    const result = await cron.computeForSubscription({ ...BASE_PARAMS, limits: ENTERPRISE_LIMITS });

    // 150 GB - 100 GB = 50 GB overage at 5 SAR/GB = 250 SAR
    expect(result.lines).toHaveLength(1);
    expect(result.lines[0]).toMatchObject({
      metric: 'STORAGE_MB',
      included: 102400, // 100 GB in MB
      used: 153600,
      overage: 51200, // 50 GB in MB
      rate: 5,
      amount: 250, // 51200 / 1024 * 5 = 250
    });
    expect(result.totalOverage).toBe(250);
  });

  it('STORAGE_MB: converts MB overage to GB for rate calculation', async () => {
    const limits: Record<string, number | boolean> = {
      maxBookingsPerMonth: 500,
      maxClients: 200,
      maxStorageMB: 10240, // 10 GB
      overageRateBookings: 0.5,
      overageRateClients: 2,
      overageRateStorageGB: 10,
    };
    const prisma = buildPrisma();
    prisma.usageRecord.findFirst = jest.fn()
      .mockResolvedValueOnce({ count: 100 })  // BOOKINGS — under
      .mockResolvedValueOnce({ count: 50 })   // CLIENTS — under
      .mockResolvedValueOnce({ count: 15360 }); // STORAGE_MB: 15 GB — over by 5 GB

    const cron = new ComputeOverageCron(prisma as never);
    const result = await cron.computeForSubscription({ ...BASE_PARAMS, limits });

    expect(result.lines).toHaveLength(1);
    // overage = 15360 - 10240 = 5120 MB = 5 GB × 10 SAR/GB = 50 SAR
    expect(result.lines[0].metric).toBe('STORAGE_MB');
    expect(result.lines[0].amount).toBe(50);
    expect(result.totalOverage).toBe(50);
  });
});
