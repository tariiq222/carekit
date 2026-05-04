import { ComputeOverageCron } from './compute-overage.cron';

const buildPrisma = (record: unknown = null) => ({
  usageRecord: {
    findFirst: jest.fn().mockResolvedValue(record),
  },
});

const STARTER_LIMITS: Record<string, number | boolean> = {
  maxBookingsPerMonth: 500,
  maxClients: 200,
  overageRateBookings: 0.5,
  overageRateClients: 2,
};

const ENTERPRISE_LIMITS: Record<string, number | boolean> = {
  maxBookingsPerMonth: -1, // unlimited
  maxClients: -1,
  overageRateBookings: 0,
  overageRateClients: 0,
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
      .mockResolvedValueOnce({ count: 50 });  // CLIENTS

    const cron = new ComputeOverageCron(prisma as never);
    const result = await cron.computeForSubscription({ ...BASE_PARAMS, limits: STARTER_LIMITS });

    expect(result.lines).toHaveLength(0);
    expect(result.totalOverage).toBe(0);
  });

  it('charges 0.50 SAR per booking above maxBookingsPerMonth: used=612, included=500 → overage=112 → 56 SAR', async () => {
    const prisma = buildPrisma();
    prisma.usageRecord.findFirst = jest.fn()
      .mockResolvedValueOnce({ count: 612 }) // BOOKINGS — over limit
      .mockResolvedValueOnce({ count: 50 });  // CLIENTS — under

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
    // Only CLIENTS will be queried (bookings is unlimited for enterprise with -1 rate)
    prisma.usageRecord.findFirst = jest.fn().mockResolvedValue({ count: 50 });

    const cron = new ComputeOverageCron(prisma as never);
    const result = await cron.computeForSubscription({ ...BASE_PARAMS, limits: ENTERPRISE_LIMITS });

    // No overage for bookings (unlimited), clients (unlimited)
    expect(result.lines).toHaveLength(0);
    expect(result.totalOverage).toBe(0);
  });

  it('charges clients overage when above maxClients', async () => {
    const limits: Record<string, number | boolean> = {
      maxBookingsPerMonth: 500,
      maxClients: 100,
      overageRateBookings: 0.5,
      overageRateClients: 2,
    };
    const prisma = buildPrisma();
    prisma.usageRecord.findFirst = jest.fn()
      .mockResolvedValueOnce({ count: 100 })  // BOOKINGS — under
      .mockResolvedValueOnce({ count: 150 }); // CLIENTS — over by 50

    const cron = new ComputeOverageCron(prisma as never);
    const result = await cron.computeForSubscription({ ...BASE_PARAMS, limits });

    expect(result.lines).toHaveLength(1);
    // overage = 150 - 100 = 50 × 2 SAR = 100 SAR
    expect(result.lines[0].metric).toBe('CLIENTS');
    expect(result.lines[0].amount).toBe(100);
    expect(result.totalOverage).toBe(100);
  });
});
