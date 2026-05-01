import { NotFoundException } from '@nestjs/common';
import { GetPublicInvoiceHandler } from './get-public-invoice.handler';

const mockInvoice = {
  id: 'inv-1',
  organizationId: 'org-1',
  branchId: 'branch-1',
  clientId: 'client-1',
  employeeId: 'emp-1',
  bookingId: 'booking-1',
  subtotal: '100.00',
  discountAmt: '10.00',
  vatRate: '0.15',
  vatAmt: '13.50',
  total: '103.50',
  currency: 'SAR',
  status: 'PAID',
  issuedAt: new Date('2026-04-17T10:00:00Z'),
  dueAt: null,
  paidAt: new Date('2026-04-17T10:05:00Z'),
  createdAt: new Date('2026-04-17T10:00:00Z'),
  zatcaSub: { qrCode: 'data:image/png;base64,xxx', status: 'REPORTED' },
};

describe('GetPublicInvoiceHandler', () => {
  const buildPrisma = (invoice: typeof mockInvoice | null = mockInvoice) => ({
    invoice: { findFirst: jest.fn().mockResolvedValue(invoice) },
    zatcaConfig: {
      findUnique: jest.fn().mockResolvedValue({ sellerName: 'Deqah Medical Clinic' }),
    },
    brandingConfig: {
      findUnique: jest.fn().mockResolvedValue({
        organizationNameEn: 'Fallback Clinic',
        organizationNameAr: 'عيادة احتياطية',
      }),
    },
  });

  it('returns invoice scoped to invoice + client with QR passthrough', async () => {
    const prisma = buildPrisma();
    const handler = new GetPublicInvoiceHandler(prisma as never);

    const result = await handler.execute('inv-1', 'client-1');

    expect(prisma.invoice.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'inv-1', clientId: 'client-1' },
      }),
    );
    expect(result.id).toBe('inv-1');
    expect(result.qrCode).toBe('data:image/png;base64,xxx');
    expect(result.zatcaStatus).toBe('REPORTED');
    expect(result.total).toBe(103.5);
  });

  it('returns the configured ZATCA seller name for client-facing invoices', async () => {
    const prisma = buildPrisma();
    const handler = new GetPublicInvoiceHandler(prisma as never);

    const result = await handler.execute('inv-1', 'client-1');

    expect(prisma.zatcaConfig.findUnique).toHaveBeenCalledWith({
      where: { organizationId: 'org-1' },
      select: { sellerName: true },
    });
    expect(result.sellerName).toBe('Deqah Medical Clinic');
  });

  it('falls back to the organization branding name when ZATCA seller name is missing', async () => {
    const prisma = buildPrisma();
    prisma.zatcaConfig.findUnique.mockResolvedValueOnce({ sellerName: null });
    const handler = new GetPublicInvoiceHandler(prisma as never);

    const result = await handler.execute('inv-1', 'client-1');

    expect(prisma.brandingConfig.findUnique).toHaveBeenCalledWith({
      where: { organizationId: 'org-1' },
      select: { organizationNameEn: true, organizationNameAr: true },
    });
    expect(result.sellerName).toBe('Fallback Clinic');
  });

  it('throws NotFoundException when no invoice belongs to this client', async () => {
    const prisma = buildPrisma(null);
    const handler = new GetPublicInvoiceHandler(prisma as never);

    await expect(handler.execute('inv-x', 'client-1')).rejects.toThrow(NotFoundException);
  });
});
