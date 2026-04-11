import { ConflictException } from '@nestjs/common';
import { CreateInvoiceHandler } from './create-invoice.handler';

const mockInvoice = {
  id: 'inv-1',
  tenantId: 'tenant-1',
  branchId: 'branch-1',
  clientId: 'client-1',
  employeeId: 'emp-1',
  bookingId: 'booking-1',
  subtotal: 200,
  discountAmt: 0,
  vatRate: 0.15,
  vatAmt: 30,
  total: 230,
  currency: 'SAR',
  status: 'ISSUED',
  issuedAt: new Date(),
  dueAt: null,
  paidAt: null,
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const buildPrisma = () => ({
  invoice: {
    findUnique: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue(mockInvoice),
  },
});

const buildEventBus = () => ({ publish: jest.fn().mockResolvedValue(undefined) });

describe('CreateInvoiceHandler', () => {
  it('creates invoice with correct VAT calculation', async () => {
    const prisma = buildPrisma();
    const eventBus = buildEventBus();
    const handler = new CreateInvoiceHandler(prisma as never, eventBus as never);

    const result = await handler.execute({
      tenantId: 'tenant-1',
      branchId: 'branch-1',
      clientId: 'client-1',
      employeeId: 'emp-1',
      bookingId: 'booking-1',
      subtotal: 200,
    });

    expect(prisma.invoice.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          subtotal: 200,
          vatRate: 0.15,
          vatAmt: 30,
          total: 230,
          status: 'ISSUED',
        }),
      }),
    );
    expect(eventBus.publish).toHaveBeenCalledWith(
      'finance.invoice.created',
      expect.objectContaining({ payload: expect.objectContaining({ bookingId: 'booking-1' }) }),
    );
    expect(result.id).toBe('inv-1');
  });

  it('applies discount before VAT', async () => {
    const prisma = buildPrisma();
    prisma.invoice.create = jest.fn().mockResolvedValue({ ...mockInvoice, discountAmt: 50, vatAmt: 22.5, total: 172.5 });
    const handler = new CreateInvoiceHandler(prisma as never, buildEventBus() as never);

    await handler.execute({
      tenantId: 'tenant-1',
      branchId: 'branch-1',
      clientId: 'client-1',
      employeeId: 'emp-1',
      bookingId: 'booking-1',
      subtotal: 200,
      discountAmt: 50,
    });

    expect(prisma.invoice.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ discountAmt: 50, vatAmt: 22.5, total: 172.5 }),
      }),
    );
  });

  it('throws ConflictException when invoice already exists for booking', async () => {
    const prisma = buildPrisma();
    prisma.invoice.findUnique = jest.fn().mockResolvedValue(mockInvoice);
    const handler = new CreateInvoiceHandler(prisma as never, buildEventBus() as never);

    await expect(
      handler.execute({
        tenantId: 'tenant-1',
        branchId: 'branch-1',
        clientId: 'client-1',
        employeeId: 'emp-1',
        bookingId: 'booking-1',
        subtotal: 200,
      }),
    ).rejects.toThrow(ConflictException);
  });
});
