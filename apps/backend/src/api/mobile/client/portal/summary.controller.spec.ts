import { MobileClientSummaryController } from './summary.controller';
import { ClientSession } from '../../../../common/auth/client-session.decorator';
import { PrismaService } from '../../../../infrastructure/database';

const USER: ClientSession = { id: 'client-1', email: null, phone: null };

function buildController(prisma: Partial<PrismaService>) {
  const controller = new MobileClientSummaryController(prisma as PrismaService);
  return { controller };
}

describe('MobileClientSummaryController', () => {
  describe('summary', () => {
    it('returns summary with all fields', async () => {
      const prisma = {
        booking: {
          count: jest.fn().mockResolvedValue(10),
          findFirst: jest.fn().mockResolvedValue({ scheduledAt: new Date('2024-01-15') }),
        },
        invoice: {
          aggregate: jest.fn().mockResolvedValue({ _sum: { total: 500 } }),
        },
      };

      const { controller } = buildController(prisma as never);
      const result = await controller.summary(USER);

      expect(result).toEqual({
        totalBookings: 10,
        lastVisit: new Date('2024-01-15'),
        outstandingBalance: 500,
      });
    });

    it('counts all bookings for client', async () => {
      const prisma = {
        booking: {
          count: jest.fn().mockResolvedValue(5),
          findFirst: jest.fn().mockResolvedValue(null),
        },
        invoice: {
          aggregate: jest.fn().mockResolvedValue({ _sum: { total: null } }),
        },
      };

      const { controller } = buildController(prisma as never);
      await controller.summary(USER);

      expect(prisma.booking.count).toHaveBeenCalledWith({
        where: { clientId: USER.id },
      });
    });

    it('finds last completed booking', async () => {
      const prisma = {
        booking: {
          count: jest.fn().mockResolvedValue(0),
          findFirst: jest.fn().mockResolvedValue(null),
        },
        invoice: {
          aggregate: jest.fn().mockResolvedValue({ _sum: { total: null } }),
        },
      };

      const { controller } = buildController(prisma as never);
      await controller.summary(USER);

      expect(prisma.booking.findFirst).toHaveBeenCalledWith({
        where: { clientId: USER.id, status: 'COMPLETED' },
        orderBy: { scheduledAt: 'desc' },
        select: { scheduledAt: true },
      });
    });

    it('returns null lastVisit when no completed bookings', async () => {
      const prisma = {
        booking: {
          count: jest.fn().mockResolvedValue(0),
          findFirst: jest.fn().mockResolvedValue(null),
        },
        invoice: {
          aggregate: jest.fn().mockResolvedValue({ _sum: { total: null } }),
        },
      };

      const { controller } = buildController(prisma as never);
      const result = await controller.summary(USER);

      expect(result.lastVisit).toBeNull();
    });

    it('aggregates unpaid invoices with ISSUED and PARTIALLY_PAID status', async () => {
      const prisma = {
        booking: {
          count: jest.fn().mockResolvedValue(0),
          findFirst: jest.fn().mockResolvedValue(null),
        },
        invoice: {
          aggregate: jest.fn().mockResolvedValue({ _sum: { total: 250.5 } }),
        },
      };

      const { controller } = buildController(prisma as never);
      const result = await controller.summary(USER);

      expect(prisma.invoice.aggregate).toHaveBeenCalledWith({
        where: {
          clientId: USER.id,
          status: { in: ['ISSUED', 'PARTIALLY_PAID'] },
        },
        _sum: { total: true },
      });
      expect(result.outstandingBalance).toBe(250.5);
    });

    it('returns 0 outstandingBalance when no unpaid invoices', async () => {
      const prisma = {
        booking: {
          count: jest.fn().mockResolvedValue(0),
          findFirst: jest.fn().mockResolvedValue(null),
        },
        invoice: {
          aggregate: jest.fn().mockResolvedValue({ _sum: { total: null } }),
        },
      };

      const { controller } = buildController(prisma as never);
      const result = await controller.summary(USER);

      expect(result.outstandingBalance).toBe(0);
    });
  });
});
