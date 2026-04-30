import { InvoiceNumberingService } from './invoice-numbering.service';

describe('InvoiceNumberingService', () => {
  const buildPrisma = () => ({
    organizationInvoiceCounter: {
      upsert: jest.fn(),
    },
  });

  it('formats numbers as INV-YYYY-NNNNNN with zero-padded sequence', async () => {
    const prisma = buildPrisma();
    prisma.organizationInvoiceCounter.upsert.mockResolvedValue({ lastSequence: 1 });
    const svc = new InvoiceNumberingService(prisma as never);

    const num = await svc.allocate('org_a', new Date('2026-04-30T00:00:00.000Z'));

    expect(num).toBe('INV-2026-000001');
    expect(prisma.organizationInvoiceCounter.upsert).toHaveBeenCalledWith({
      where: { organizationId_year: { organizationId: 'org_a', year: 2026 } },
      create: { organizationId: 'org_a', year: 2026, lastSequence: 1 },
      update: { lastSequence: { increment: 1 } },
    });
  });

  it('uses the year from the provided date in UTC', async () => {
    const prisma = buildPrisma();
    prisma.organizationInvoiceCounter.upsert.mockResolvedValue({ lastSequence: 42 });
    const svc = new InvoiceNumberingService(prisma as never);

    const num = await svc.allocate('org_b', new Date('2027-01-15T10:00:00.000Z'));

    expect(num).toBe('INV-2027-000042');
  });

  it('uses the transaction client when provided', async () => {
    const prisma = buildPrisma();
    const tx = {
      organizationInvoiceCounter: {
        upsert: jest.fn().mockResolvedValue({ lastSequence: 5 }),
      },
    };
    const svc = new InvoiceNumberingService(prisma as never);

    const num = await svc.allocate('org_a', new Date('2026-04-30T00:00:00.000Z'), tx as never);

    expect(num).toBe('INV-2026-000005');
    expect(tx.organizationInvoiceCounter.upsert).toHaveBeenCalledTimes(1);
    expect(prisma.organizationInvoiceCounter.upsert).not.toHaveBeenCalled();
  });

  it('zero-pads larger sequence numbers correctly', async () => {
    const prisma = buildPrisma();
    prisma.organizationInvoiceCounter.upsert.mockResolvedValue({ lastSequence: 123456 });
    const svc = new InvoiceNumberingService(prisma as never);

    const num = await svc.allocate('org_a', new Date('2026-01-01T00:00:00.000Z'));

    expect(num).toBe('INV-2026-123456');
  });
});
