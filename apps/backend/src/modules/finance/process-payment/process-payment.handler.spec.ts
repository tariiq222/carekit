import { NotFoundException, BadRequestException } from '@nestjs/common';
import { InvoiceStatus, PaymentMethod } from '@prisma/client';
import { ProcessPaymentHandler } from './process-payment.handler';

const mockInvoice = {
  id: 'inv-1',
  tenantId: 'tenant-1',
  bookingId: 'booking-1',
  currency: 'SAR',
  total: 230,
  status: InvoiceStatus.ISSUED,
};

const mockPayment = {
  id: 'pay-1',
  tenantId: 'tenant-1',
  invoiceId: 'inv-1',
  amount: 230,
  method: PaymentMethod.ONLINE_CARD,
  status: 'COMPLETED',
  idempotencyKey: 'key-1',
  processedAt: new Date(),
};

const buildPrisma = (overrides: Record<string, unknown> = {}) => ({
  invoice: {
    findUnique: jest.fn().mockResolvedValue(mockInvoice),
    update: jest.fn().mockResolvedValue({ ...mockInvoice, status: InvoiceStatus.PAID }),
  },
  payment: {
    findUnique: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue(mockPayment),
    aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 230 } }),
  },
  ...overrides,
});

const buildEventBus = () => ({ publish: jest.fn().mockResolvedValue(undefined) });

describe('ProcessPaymentHandler', () => {
  it('creates payment and marks invoice PAID when fully paid', async () => {
    const prisma = buildPrisma();
    const eventBus = buildEventBus();
    const handler = new ProcessPaymentHandler(prisma as never, eventBus as never);

    const result = await handler.execute({
      tenantId: 'tenant-1',
      invoiceId: 'inv-1',
      amount: 230,
      method: PaymentMethod.ONLINE_CARD,
      idempotencyKey: 'key-1',
    });

    expect(prisma.payment.create).toHaveBeenCalled();
    expect(prisma.invoice.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: InvoiceStatus.PAID }) }),
    );
    expect(eventBus.publish).toHaveBeenCalledWith(
      'finance.payment.completed',
      expect.objectContaining({ payload: expect.objectContaining({ bookingId: 'booking-1' }) }),
    );
    expect(result.id).toBe('pay-1');
  });

  it('marks invoice PARTIALLY_PAID when underpaid', async () => {
    const prisma = buildPrisma();
    prisma.payment.aggregate = jest.fn().mockResolvedValue({ _sum: { amount: 100 } });
    const handler = new ProcessPaymentHandler(prisma as never, buildEventBus() as never);

    await handler.execute({ tenantId: 'tenant-1', invoiceId: 'inv-1', amount: 100, method: PaymentMethod.CASH });

    expect(prisma.invoice.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: InvoiceStatus.PARTIALLY_PAID }) }),
    );
  });

  it('returns existing payment when idempotency key matches', async () => {
    const prisma = buildPrisma();
    prisma.payment.findUnique = jest.fn().mockResolvedValue(mockPayment);
    const handler = new ProcessPaymentHandler(prisma as never, buildEventBus() as never);

    const result = await handler.execute({
      tenantId: 'tenant-1',
      invoiceId: 'inv-1',
      amount: 230,
      method: PaymentMethod.ONLINE_CARD,
      idempotencyKey: 'key-1',
    });

    expect(prisma.payment.create).not.toHaveBeenCalled();
    expect(result.id).toBe('pay-1');
  });

  it('throws NotFoundException when invoice not found', async () => {
    const prisma = buildPrisma();
    prisma.invoice.findUnique = jest.fn().mockResolvedValue(null);
    const handler = new ProcessPaymentHandler(prisma as never, buildEventBus() as never);

    await expect(
      handler.execute({ tenantId: 'tenant-1', invoiceId: 'bad-id', amount: 100, method: PaymentMethod.CASH }),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws BadRequestException when invoice is VOID', async () => {
    const prisma = buildPrisma();
    prisma.invoice.findUnique = jest.fn().mockResolvedValue({ ...mockInvoice, status: InvoiceStatus.VOID });
    const handler = new ProcessPaymentHandler(prisma as never, buildEventBus() as never);

    await expect(
      handler.execute({ tenantId: 'tenant-1', invoiceId: 'inv-1', amount: 100, method: PaymentMethod.CASH }),
    ).rejects.toThrow(BadRequestException);
  });
});
