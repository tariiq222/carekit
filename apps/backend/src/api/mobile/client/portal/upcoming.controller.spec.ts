import { MobileClientUpcomingController, UpcomingQuery } from './upcoming.controller';
import { JwtUser } from '../../../../common/auth/current-user.decorator';
import { PrismaService } from '../../../../infrastructure/database';
import { BookingStatus } from '@prisma/client';

const USER: JwtUser = { sub: 'client-1', email: 'client@test.com', roles: [] };

function buildController(prisma: Partial<PrismaService>) {
  const controller = new MobileClientUpcomingController(prisma as PrismaService);
  return { controller };
}

describe('MobileClientUpcomingController', () => {
  describe('upcoming', () => {
    it('returns upcoming bookings with pagination meta', async () => {
      const mockData = [{ id: 'b-1', status: BookingStatus.CONFIRMED }];
      const prisma = {
        booking: {
          findMany: jest.fn().mockResolvedValue(mockData),
          count: jest.fn().mockResolvedValue(1),
        },
      };

      const { controller } = buildController(prisma as never);
      const result = await controller.upcoming(USER, {});

      expect(result).toEqual({
        data: mockData,
        meta: { total: 1, page: 1, limit: 10, totalPages: 1 },
      });
    });

    it('applies default pagination when not provided', async () => {
      const prisma = {
        booking: {
          findMany: jest.fn().mockResolvedValue([]),
          count: jest.fn().mockResolvedValue(0),
        },
      };

      const { controller } = buildController(prisma as never);
      await controller.upcoming(USER, {});

      expect(prisma.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 10 }),
      );
    });

    it('uses provided page and limit', async () => {
      const prisma = {
        booking: {
          findMany: jest.fn().mockResolvedValue([]),
          count: jest.fn().mockResolvedValue(25),
        },
      };

      const { controller } = buildController(prisma as never);
      const query: UpcomingQuery = { page: 3, limit: 5 };
      const result = await controller.upcoming(USER, query);

      expect(prisma.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 5 }),
      );
      expect(result.meta).toEqual({ total: 25, page: 3, limit: 5, totalPages: 5 });
    });

    it('filters by clientId and upcoming statuses', async () => {
      const prisma = {
        booking: {
          findMany: jest.fn().mockResolvedValue([]),
          count: jest.fn().mockResolvedValue(0),
        },
      };

      const { controller } = buildController(prisma as never);
      await controller.upcoming(USER, {});

      expect(prisma.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            clientId: USER.sub,
            status: { in: [BookingStatus.PENDING, BookingStatus.CONFIRMED] },
          }),
        }),
      );
    });

    it('orders by scheduledAt ascending', async () => {
      const prisma = {
        booking: {
          findMany: jest.fn().mockResolvedValue([]),
          count: jest.fn().mockResolvedValue(0),
        },
      };

      const { controller } = buildController(prisma as never);
      await controller.upcoming(USER, {});

      expect(prisma.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { scheduledAt: 'asc' } }),
      );
    });
  });
});
