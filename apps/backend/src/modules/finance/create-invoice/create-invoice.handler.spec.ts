import { CreateInvoiceHandler } from './create-invoice.handler';

const mockInvoice = {
  id: 'inv-1',
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
  organizationId: '00000000-0000-0000-0000-000000000001',
};

const buildPrisma = () => ({
  invoice: {
    upsert: jest.fn().mockResolvedValue(mockInvoice),
  },
});

const buildEventBus = () => ({ publish: jest.fn().mockResolvedValue(undefined) });

const buildTenant = () => ({
  requireOrganizationIdOrDefault: jest.fn().mockReturnValue('00000000-0000-0000-0000-000000000001'),
});

describe('CreateInvoiceHandler', () => {
  it('creates invoice with correct VAT calculation', async () => {
    const prisma = buildPrisma();
    const eventBus = buildEventBus();
    const handler = new CreateInvoiceHandler(prisma as never, eventBus as never, buildTenant() as never);

    const result = await handler.execute({
      branchId: 'branch-1',
      clientId: 'client-1',
      employeeId: 'emp-1',
      bookingId: 'booking-1',
      subtotal: 200,
    });

    expect(prisma.invoice.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { bookingId: 'booking-1' },
        create: expect.objectContaining({
          subtotal: 200,
          vatRate: 0.15,
          vatAmt: 30,
          total: 230,
          status: 'ISSUED',
        }),
        update: {},
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
    prisma.invoice.upsert = jest.fn().mockResolvedValue({ ...mockInvoice, discountAmt: 50, vatAmt: 22.5, total: 172.5 });
    const handler = new CreateInvoiceHandler(prisma as never, buildEventBus() as never, buildTenant() as never);

    await handler.execute({
      branchId: 'branch-1',
      clientId: 'client-1',
      employeeId: 'emp-1',
      bookingId: 'booking-1',
      subtotal: 200,
      discountAmt: 50,
    });

    expect(prisma.invoice.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ discountAmt: 50, vatAmt: 22.5, total: 172.5 }),
        update: {},
      }),
    );
  });

  it('is idempotent on re-delivery — upsert returns existing invoice without error', async () => {
    const prisma = buildPrisma();
    // Simulate the DB returning the existing row on upsert (idempotent behavior)
    prisma.invoice.upsert = jest.fn().mockResolvedValue(mockInvoice);
    const handler = new CreateInvoiceHandler(prisma as never, buildEventBus() as never, buildTenant() as never);

    const result = await handler.execute({
      branchId: 'branch-1',
      clientId: 'client-1',
      employeeId: 'emp-1',
      bookingId: 'booking-1',
      subtotal: 200,
    });

    expect(result.id).toBe('inv-1');
    expect(prisma.invoice.upsert).toHaveBeenCalledTimes(1);
  });
});
