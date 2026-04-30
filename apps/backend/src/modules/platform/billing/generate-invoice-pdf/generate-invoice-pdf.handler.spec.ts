import { BadRequestException, NotFoundException } from '@nestjs/common';
import { GenerateInvoicePdfHandler } from './generate-invoice-pdf.handler';

const buildPrisma = () => ({
  subscriptionInvoice: {
    findFirst: jest.fn(),
    update: jest.fn().mockResolvedValue({}),
  },
});

const buildMinio = () => ({
  fileExists: jest.fn(),
  uploadFile: jest.fn().mockResolvedValue('s3://etag'),
  getSignedUrl: jest.fn(),
});

const buildRenderer = () => ({
  render: jest.fn().mockResolvedValue(Buffer.from('%PDF-1.4 fake')),
});

const buildTenant = (organizationId = 'org-A') => ({
  requireOrganizationId: jest.fn().mockReturnValue(organizationId),
});

const buildConfig = (
  overrides: Partial<Record<string, string | undefined>> = {},
) => ({
  get: jest.fn((k: string) =>
    k in overrides ? overrides[k] : 'carekit-invoices',
  ),
  getOrThrow: jest.fn((k: string) => {
    if (k === 'MINIO_BUCKET') return 'carekit';
    if (k === 'PLATFORM_COMPANY_NAME_AR') return 'منصة كير كِت';
    if (k === 'PLATFORM_VAT_NUMBER') return '300000000000003';
    throw new Error(`missing ${k}`);
  }),
});

const issuedInvoice = {
  id: 'inv-1',
  organizationId: 'org-A',
  amount: { toString: () => '115.00' },
  currency: 'SAR',
  periodStart: new Date('2026-04-01T00:00:00.000Z'),
  periodEnd: new Date('2026-04-30T23:59:59.999Z'),
  issuedAt: new Date('2026-04-30T12:00:00.000Z'),
  invoiceNumber: 'INV-2026-000001',
  invoiceHash: 'a'.repeat(64),
  pdfStorageKey: null,
  pdfUrl: null,
  lineItems: [{ description: 'Subscription', amount: 115 }],
  subscription: {
    plan: { nameAr: 'باقة برو', nameEn: 'Pro' },
    organization: { nameAr: 'سواء', nameEn: 'Sawa' },
  },
};

// Number(invoice.amount) in handler — we pass a Decimal-like object via toString
// but Number({toString}) calls valueOf first. Use a plain number for simplicity:
issuedInvoice.amount = 115 as never;

describe('GenerateInvoicePdfHandler', () => {
  it('throws NotFoundException for cross-org invoice', async () => {
    const prisma = buildPrisma();
    prisma.subscriptionInvoice.findFirst.mockResolvedValue(null);
    const handler = new GenerateInvoicePdfHandler(
      prisma as never,
      buildRenderer() as never,
      buildMinio() as never,
      buildTenant('org-B') as never,
      buildConfig() as never,
    );

    await expect(handler.execute('inv-1')).rejects.toThrow(NotFoundException);
  });

  it('throws BadRequest when invoice has not been issued yet', async () => {
    const prisma = buildPrisma();
    prisma.subscriptionInvoice.findFirst.mockResolvedValue({
      ...issuedInvoice,
      issuedAt: null,
      invoiceNumber: null,
    });
    const handler = new GenerateInvoicePdfHandler(
      prisma as never,
      buildRenderer() as never,
      buildMinio() as never,
      buildTenant() as never,
      buildConfig() as never,
    );

    await expect(handler.execute('inv-1')).rejects.toThrow(BadRequestException);
  });

  it('short-circuits when pdfStorageKey exists in MinIO', async () => {
    const prisma = buildPrisma();
    prisma.subscriptionInvoice.findFirst.mockResolvedValue({
      ...issuedInvoice,
      pdfStorageKey: 'invoices/org-A/inv-1.pdf',
    });
    const minio = buildMinio();
    minio.fileExists.mockResolvedValue(true);
    const renderer = buildRenderer();
    const handler = new GenerateInvoicePdfHandler(
      prisma as never,
      renderer as never,
      minio as never,
      buildTenant() as never,
      buildConfig() as never,
    );

    const out = await handler.execute('inv-1');

    expect(out).toEqual({ key: 'invoices/org-A/inv-1.pdf' });
    expect(renderer.render).not.toHaveBeenCalled();
    expect(minio.uploadFile).not.toHaveBeenCalled();
    expect(prisma.subscriptionInvoice.update).not.toHaveBeenCalled();
  });

  it('renders, uploads, and persists pdfStorageKey on first call', async () => {
    const prisma = buildPrisma();
    prisma.subscriptionInvoice.findFirst.mockResolvedValue(issuedInvoice);
    const minio = buildMinio();
    const renderer = buildRenderer();
    const handler = new GenerateInvoicePdfHandler(
      prisma as never,
      renderer as never,
      minio as never,
      buildTenant() as never,
      buildConfig() as never,
    );

    const out = await handler.execute('inv-1');

    expect(out).toEqual({ key: 'invoices/org-A/inv-1.pdf' });
    expect(renderer.render).toHaveBeenCalledTimes(1);
    expect(minio.uploadFile).toHaveBeenCalledWith(
      'carekit-invoices',
      'invoices/org-A/inv-1.pdf',
      expect.any(Buffer),
      'application/pdf',
    );
    expect(prisma.subscriptionInvoice.update).toHaveBeenCalledWith({
      where: { id: 'inv-1' },
      data: { pdfStorageKey: 'invoices/org-A/inv-1.pdf' },
    });
  });

  it('falls back to MINIO_BUCKET when MINIO_INVOICE_BUCKET is unset', async () => {
    const prisma = buildPrisma();
    prisma.subscriptionInvoice.findFirst.mockResolvedValue(issuedInvoice);
    const minio = buildMinio();
    const handler = new GenerateInvoicePdfHandler(
      prisma as never,
      buildRenderer() as never,
      minio as never,
      buildTenant() as never,
      buildConfig({ MINIO_INVOICE_BUCKET: undefined }) as never,
    );

    await handler.execute('inv-1');

    expect(minio.uploadFile).toHaveBeenCalledWith(
      'carekit',
      expect.any(String),
      expect.any(Buffer),
      'application/pdf',
    );
  });

  it('derives subtotal/vat/total from VAT-inclusive amount (115 → 100/15/115)', async () => {
    const prisma = buildPrisma();
    prisma.subscriptionInvoice.findFirst.mockResolvedValue(issuedInvoice);
    const renderer = buildRenderer();
    const handler = new GenerateInvoicePdfHandler(
      prisma as never,
      renderer as never,
      buildMinio() as never,
      buildTenant() as never,
      buildConfig() as never,
    );

    await handler.execute('inv-1');

    expect(renderer.render).toHaveBeenCalledWith(
      expect.objectContaining({
        subtotal: '100.00',
        vatAmount: '15.00',
        total: '115.00',
      }),
    );
  });
});
