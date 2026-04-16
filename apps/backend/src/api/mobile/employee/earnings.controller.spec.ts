import { MobileEmployeeEarningsController } from './earnings.controller';
import { InvoiceStatus } from '@prisma/client';

const USER = { sub: 'user-1' };

function mockPrisma(overrides: Partial<{
  findMany: jest.Mock;
}> = {}) {
  return {
    invoice: {
      findMany: overrides.findMany ?? jest.fn().mockResolvedValue([]),
    },
  };
}

describe('MobileEmployeeEarningsController', () => {
  describe('earnings', () => {
    it('queries PAID invoices for the employee within the date range', async () => {
      const prisma = mockPrisma();
      const controller = new MobileEmployeeEarningsController(prisma as never);
      await controller.earnings(USER, {} as never);
      expect(prisma.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            employeeId: USER.sub,
            status: InvoiceStatus.PAID,
          }),
        }),
      );
    });

    it('includes payments in the query', async () => {
      const prisma = mockPrisma();
      const controller = new MobileEmployeeEarningsController(prisma as never);
      await controller.earnings(USER, {} as never);
      expect(prisma.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            payments: { select: { amount: true, method: true } },
          }),
        }),
      );
    });

    it('returns period, totalEarnings, invoiceCount, and byMethod', async () => {
      const prisma = mockPrisma({
        findMany: jest.fn().mockResolvedValue([
          {
            total: 100,
            payments: [{ amount: 100, method: 'CARD' }],
          },
        ]),
      });
      const controller = new MobileEmployeeEarningsController(prisma as never);
      const result = await controller.earnings(USER, {} as never);
      expect(result).toHaveProperty('period');
      expect(result).toHaveProperty('totalEarnings');
      expect(result).toHaveProperty('invoiceCount');
      expect(result).toHaveProperty('byMethod');
    });

    it('sums invoice totals for totalEarnings', async () => {
      const prisma = mockPrisma({
        findMany: jest.fn().mockResolvedValue([
          { total: 100, payments: [] },
          { total: 200, payments: [] },
          { total: 50, payments: [] },
        ]),
      });
      const controller = new MobileEmployeeEarningsController(prisma as never);
      const result = await controller.earnings(USER, {} as never);
      expect(result.totalEarnings).toBe(350);
    });

    it('counts invoices correctly', async () => {
      const prisma = mockPrisma({
        findMany: jest.fn().mockResolvedValue([
          { total: 100, payments: [] },
          { total: 200, payments: [] },
        ]),
      });
      const controller = new MobileEmployeeEarningsController(prisma as never);
      const result = await controller.earnings(USER, {} as never);
      expect(result.invoiceCount).toBe(2);
    });

    it('groups earnings by payment method in byMethod', async () => {
      const prisma = mockPrisma({
        findMany: jest.fn().mockResolvedValue([
          { total: 100, payments: [{ amount: 50, method: 'CARD' }, { amount: 50, method: 'CASH' }] },
          { total: 200, payments: [{ amount: 200, method: 'CARD' }] },
        ]),
      });
      const controller = new MobileEmployeeEarningsController(prisma as never);
      const result = await controller.earnings(USER, {} as never);
      expect(result.byMethod['CARD']).toBe(250);
      expect(result.byMethod['CASH']).toBe(50);
    });

    it('handles empty invoice list', async () => {
      const prisma = mockPrisma({
        findMany: jest.fn().mockResolvedValue([]),
      });
      const controller = new MobileEmployeeEarningsController(prisma as never);
      const result = await controller.earnings(USER, {} as never);
      expect(result.totalEarnings).toBe(0);
      expect(result.invoiceCount).toBe(0);
      expect(result.byMethod).toEqual({});
    });

    it('defaults to current month when no dates provided', async () => {
      const prisma = mockPrisma();
      const controller = new MobileEmployeeEarningsController(prisma as never);
      await controller.earnings(USER, {} as never);
      const call = prisma.invoice.findMany.mock.calls[0][0];
      expect(call.where.paidAt).toBeDefined();
      expect(call.where.paidAt).toHaveProperty('gte');
      expect(call.where.paidAt).toHaveProperty('lte');
    });

    it('uses provided from date when given', async () => {
      const prisma = mockPrisma();
      const controller = new MobileEmployeeEarningsController(prisma as never);
      await controller.earnings(USER, { from: '2026-01-01', to: undefined } as never);
      const call = prisma.invoice.findMany.mock.calls[0][0];
      expect(call.where.paidAt.gte).toBeInstanceOf(Date);
    });

    it('uses provided to date when given', async () => {
      const prisma = mockPrisma();
      const controller = new MobileEmployeeEarningsController(prisma as never);
      await controller.earnings(USER, { from: undefined, to: '2026-12-31' } as never);
      const call = prisma.invoice.findMany.mock.calls[0][0];
      expect(call.where.paidAt.lte).toBeInstanceOf(Date);
    });
  });
});
