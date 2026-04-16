import { MobileEmployeeClientsController } from './clients.controller';

const USER = { sub: 'user-1' };

// Minimal prisma mock
function mockPrisma(overrides: Partial<{
  findMany: jest.Mock;
  count: jest.Mock;
}> = {}) {
  return {
    booking: {
      findMany: overrides.findMany ?? jest.fn().mockResolvedValue([]),
    },
    client: {
      findMany: overrides.findMany ?? jest.fn().mockResolvedValue([]),
      count: overrides.count ?? jest.fn().mockResolvedValue(0),
    },
  };
}

describe('MobileEmployeeClientsController', () => {
  describe('listMyClients', () => {
    it('fetches distinct clientIds from bookings for the employee', async () => {
      const prisma = mockPrisma();
      const controller = new MobileEmployeeClientsController(prisma as never);
      await controller.listMyClients(USER as never, {} as never);
      expect(prisma.booking.findMany).toHaveBeenCalledWith({
        where: { employeeId: USER.sub },
        select: { clientId: true },
        distinct: ['clientId'],
      });
    });

    it('returns clients with pagination meta', async () => {
      const prisma = mockPrisma({
        findMany: jest.fn().mockResolvedValue([{ id: 'c-1', name: 'Ahmed' }]),
        count: jest.fn().mockResolvedValue(1),
      });
      const controller = new MobileEmployeeClientsController(prisma as never);
      const result = await controller.listMyClients(USER as never, {} as never);
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('meta');
      expect(result.meta.total).toBe(1);
    });

    it('defaults page to 1 and limit to 20', async () => {
      const prisma = mockPrisma();
      const controller = new MobileEmployeeClientsController(prisma as never);
      await controller.listMyClients(USER as never, {} as never);
      expect(prisma.client.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 20 }),
      );
    });

    it('applies custom page and limit', async () => {
      const prisma = mockPrisma();
      const controller = new MobileEmployeeClientsController(prisma as never);
      await controller.listMyClients(USER as never, { page: 3, limit: 10 } as never);
      expect(prisma.client.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 10 }),
      );
    });

    it('searches by name when search param is provided', async () => {
      const prisma = mockPrisma();
      const controller = new MobileEmployeeClientsController(prisma as never);
      await controller.listMyClients(USER as never, { search: 'Ahmed' } as never);
      expect(prisma.client.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({ name: expect.objectContaining({ contains: 'Ahmed', mode: 'insensitive' }) }),
            ]),
          }),
        }),
      );
    });

    it('searches by phone when search param is provided', async () => {
      const prisma = mockPrisma();
      const controller = new MobileEmployeeClientsController(prisma as never);
      await controller.listMyClients(USER as never, { search: '0500' } as never);
      expect(prisma.client.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({ phone: expect.objectContaining({ contains: '0500', mode: 'insensitive' }) }),
            ]),
          }),
        }),
      );
    });

    it('orders clients by name ascending', async () => {
      const prisma = mockPrisma();
      const controller = new MobileEmployeeClientsController(prisma as never);
      await controller.listMyClients(USER as never, {} as never);
      expect(prisma.client.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { name: 'asc' } }),
      );
    });

    it('includes correct totalPages in meta', async () => {
      const prisma = mockPrisma({
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(45),
      });
      const controller = new MobileEmployeeClientsController(prisma as never);
      const result = await controller.listMyClients(USER as never, {} as never);
      expect(result.meta.totalPages).toBe(3); // 45 / 20 = 2.25 -> ceil = 3
    });
  });

  describe('clientHistory', () => {
    it('fetches bookings for the given clientId', async () => {
      const prisma = mockPrisma();
      const controller = new MobileEmployeeClientsController(prisma as never);
      await controller.clientHistory(USER as never, 'c-1');
      expect(prisma.booking.findMany).toHaveBeenCalledWith({
        where: { employeeId: USER.sub, clientId: 'c-1' },
        orderBy: { scheduledAt: 'desc' },
        take: 20,
      });
    });

    it('returns bookings ordered by scheduledAt desc', async () => {
      const prisma = mockPrisma({
        findMany: jest.fn().mockResolvedValue([{ id: 'b-1' }, { id: 'b-2' }]),
      });
      const controller = new MobileEmployeeClientsController(prisma as never);
      const result = await controller.clientHistory(USER as never, 'c-1');
      expect(result).toHaveLength(2);
      expect(prisma.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { scheduledAt: 'desc' } }),
      );
    });

    it('limits results to 20 bookings', async () => {
      const prisma = mockPrisma();
      const controller = new MobileEmployeeClientsController(prisma as never);
      await controller.clientHistory(USER as never, 'c-1');
      expect(prisma.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 20 }),
      );
    });
  });
});
