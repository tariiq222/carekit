import { Prisma } from '@prisma/client';
import { BookingsStatsHandler } from './bookings-stats.handler';

const buildTenant = () => ({ requireOrganizationId: () => 'org-test' } as never);

describe('BookingsStatsHandler', () => {
  const buildPrisma = () => ({
    booking: {
      count: jest
        .fn()
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(7)
        .mockResolvedValueOnce(3),
      aggregate: jest.fn().mockResolvedValue({ _sum: { price: new Prisma.Decimal(45000) } }),
    },
  });

  it('returns todayCount, pendingCount, completedToday, revenueToday', async () => {
    const prisma = buildPrisma();
    const handler = new BookingsStatsHandler(prisma as never, buildTenant());
    const result = await handler.execute();
    expect(result).toEqual({
      todayCount: 5,
      pendingCount: 7,
      completedToday: 3,
      revenueToday: 450,
    });
  });

  it('handles null revenue (no completed bookings yet)', async () => {
    const prisma = buildPrisma();
    prisma.booking.aggregate = jest.fn().mockResolvedValue({ _sum: { price: null } });
    const handler = new BookingsStatsHandler(prisma as never, buildTenant());
    const result = await handler.execute();
    expect(result.revenueToday).toBe(0);
  });
});
