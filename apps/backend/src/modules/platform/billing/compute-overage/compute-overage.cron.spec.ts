import { ComputeOverageCron } from './compute-overage.cron';

const buildPrisma = (record: unknown = null) => ({
  usageRecord: {
    findFirst: jest.fn().mockResolvedValue(record),
  },
});

const buildFlags = (planVersioningEnabled = false) => ({ planVersioningEnabled });

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

    const cron = new ComputeOverageCron(prisma as never, buildFlags() as never);
    const result = await cron.computeForSubscription({ ...BASE_PARAMS, limits: STARTER_LIMITS });

    expect(result.lines).toHaveLength(0);
    expect(result.totalOverage).toBe(0);
  });

  it('charges 0.50 SAR per booking above maxBookingsPerMonth: used=612, included=500 → overage=112 → 56 SAR', async () => {
    const prisma = buildPrisma();
    prisma.usageRecord.findFirst = jest.fn()
      .mockResolvedValueOnce({ count: 612 }) // BOOKINGS — over limit
      .mockResolvedValueOnce({ count: 50 });  // CLIENTS — under

    const cron = new ComputeOverageCron(prisma as never, buildFlags() as never);
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

    const cron = new ComputeOverageCron(prisma as never, buildFlags() as never);
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

    const cron = new ComputeOverageCron(prisma as never, buildFlags() as never);
    const result = await cron.computeForSubscription({ ...BASE_PARAMS, limits });

    expect(result.lines).toHaveLength(1);
    // overage = 150 - 100 = 50 × 2 SAR = 100 SAR
    expect(result.lines[0].metric).toBe('CLIENTS');
    expect(result.lines[0].amount).toBe(100);
    expect(result.totalOverage).toBe(100);
  });

  it('uses planVersionLimits when flag on (legacy plan limit reduced but sub keeps original lower rate)', async () => {
    // planVersion had 0.5/booking overage rate and 500 limit
    // live plan now has 1.0/booking overage rate and 200 limit
    // With flag on → uses planVersion (0.5 rate, 500 limit)
    const prisma = buildPrisma();
    prisma.usageRecord.findFirst = jest.fn()
      .mockResolvedValueOnce({ count: 600 }) // BOOKINGS — 100 over planVersion limit (500), but only 600-500=100 overage
      .mockResolvedValueOnce({ count: 10 });  // CLIENTS — under

    const limits: Record<string, number | boolean> = {
      maxBookingsPerMonth: 200,
      maxClients: 1000,
      overageRateBookings: 1.0,
      overageRateClients: 0,
    };
    const planVersionLimits: Record<string, number | boolean> = {
      maxBookingsPerMonth: 500,
      maxClients: 1000,
      overageRateBookings: 0.5,
      overageRateClients: 0,
    };

    const cron = new ComputeOverageCron(prisma as never, buildFlags(true) as never);
    const result = await cron.computeForSubscription({
      ...BASE_PARAMS,
      limits,
      planVersionLimits,
    });

    // Should use planVersion: 100 overage × 0.5 = 50 SAR (not 400 overage × 1.0)
    expect(result.lines[0]).toMatchObject({ overage: 100, rate: 0.5, amount: 50 });
  });

  it('falls back to live plan when flag off', async () => {
    const prisma = buildPrisma();
    prisma.usageRecord.findFirst = jest.fn()
      .mockResolvedValueOnce({ count: 600 })
      .mockResolvedValueOnce({ count: 10 });

    const limits: Record<string, number | boolean> = {
      maxBookingsPerMonth: 200,
      maxClients: 1000,
      overageRateBookings: 1.0,
      overageRateClients: 0,
    };
    const planVersionLimits: Record<string, number | boolean> = {
      maxBookingsPerMonth: 500,
      maxClients: 1000,
      overageRateBookings: 0.5,
      overageRateClients: 0,
    };

    const cron = new ComputeOverageCron(prisma as never, buildFlags(false) as never);
    const result = await cron.computeForSubscription({
      ...BASE_PARAMS,
      limits,
      planVersionLimits,
    });

    // Should use live plan: 400 overage × 1.0 = 400 SAR
    expect(result.lines[0]).toMatchObject({ overage: 400, rate: 1.0, amount: 400 });
  });
});
