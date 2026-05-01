import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DownloadInvoiceHandler } from './download-invoice.handler';

const buildPrisma = () => ({
  subscriptionInvoice: {
    findFirst: jest.fn(),
  },
});

const buildMinio = () => ({
  fileExists: jest.fn(),
  getSignedUrl: jest.fn().mockResolvedValue('https://signed.example/pdf'),
});

const buildGenerator = () => ({
  execute: jest.fn().mockResolvedValue({ key: 'invoices/org-A/inv-1.pdf' }),
});

const buildTenant = (organizationId = 'org-A') => ({
  requireOrganizationId: jest.fn().mockReturnValue(organizationId),
});

const buildConfig = () => ({
  get: jest.fn().mockReturnValue('deqah-invoices'),
  getOrThrow: jest.fn().mockReturnValue('deqah'),
});

describe('DownloadInvoiceHandler', () => {
  it('returns 404 when invoice belongs to a different org', async () => {
    const prisma = buildPrisma();
    prisma.subscriptionInvoice.findFirst.mockResolvedValue(null);
    const handler = new DownloadInvoiceHandler(
      prisma as never,
      buildGenerator() as never,
      buildMinio() as never,
      buildTenant('org-B') as never,
      buildConfig() as never,
    );

    await expect(handler.execute('inv-1')).rejects.toThrow(NotFoundException);
  });

  it('returns BadRequest when invoice not yet issued', async () => {
    const prisma = buildPrisma();
    prisma.subscriptionInvoice.findFirst.mockResolvedValue({
      pdfStorageKey: null,
      pdfUrl: null,
      issuedAt: null,
      invoiceNumber: null,
    });
    const handler = new DownloadInvoiceHandler(
      prisma as never,
      buildGenerator() as never,
      buildMinio() as never,
      buildTenant() as never,
      buildConfig() as never,
    );

    await expect(handler.execute('inv-1')).rejects.toThrow(BadRequestException);
  });

  it('returns presigned URL when cached PDF exists in MinIO', async () => {
    const prisma = buildPrisma();
    prisma.subscriptionInvoice.findFirst.mockResolvedValue({
      pdfStorageKey: 'invoices/org-A/inv-1.pdf',
      pdfUrl: null,
      issuedAt: new Date(),
      invoiceNumber: 'INV-2026-000001',
    });
    const minio = buildMinio();
    minio.fileExists.mockResolvedValue(true);
    const generator = buildGenerator();
    const handler = new DownloadInvoiceHandler(
      prisma as never,
      generator as never,
      minio as never,
      buildTenant() as never,
      buildConfig() as never,
    );

    const out = await handler.execute('inv-1');

    expect(out).toEqual({ url: 'https://signed.example/pdf' });
    expect(minio.getSignedUrl).toHaveBeenCalledWith(
      'deqah-invoices',
      'invoices/org-A/inv-1.pdf',
      600,
    );
    expect(generator.execute).not.toHaveBeenCalled();
  });

  it('passes through legacy pdfUrl when no storage key is cached', async () => {
    const prisma = buildPrisma();
    prisma.subscriptionInvoice.findFirst.mockResolvedValue({
      pdfStorageKey: null,
      pdfUrl: 'https://legacy.example/old.pdf',
      issuedAt: new Date(),
      invoiceNumber: 'INV-2026-000001',
    });
    const generator = buildGenerator();
    const handler = new DownloadInvoiceHandler(
      prisma as never,
      generator as never,
      buildMinio() as never,
      buildTenant() as never,
      buildConfig() as never,
    );

    const out = await handler.execute('inv-1');

    expect(out).toEqual({ url: 'https://legacy.example/old.pdf' });
    expect(generator.execute).not.toHaveBeenCalled();
  });

  it('falls through to generator on first download', async () => {
    const prisma = buildPrisma();
    prisma.subscriptionInvoice.findFirst.mockResolvedValue({
      pdfStorageKey: null,
      pdfUrl: null,
      issuedAt: new Date(),
      invoiceNumber: 'INV-2026-000001',
    });
    const generator = buildGenerator();
    const minio = buildMinio();
    const handler = new DownloadInvoiceHandler(
      prisma as never,
      generator as never,
      minio as never,
      buildTenant() as never,
      buildConfig() as never,
    );

    const out = await handler.execute('inv-1');

    expect(generator.execute).toHaveBeenCalledWith('inv-1');
    expect(minio.getSignedUrl).toHaveBeenCalledWith(
      'deqah-invoices',
      'invoices/org-A/inv-1.pdf',
      600,
    );
    expect(out.url).toBe('https://signed.example/pdf');
  });

  it('regenerates if pdfStorageKey is set but object missing in MinIO', async () => {
    const prisma = buildPrisma();
    prisma.subscriptionInvoice.findFirst.mockResolvedValue({
      pdfStorageKey: 'invoices/org-A/inv-1.pdf',
      pdfUrl: null,
      issuedAt: new Date(),
      invoiceNumber: 'INV-2026-000001',
    });
    const minio = buildMinio();
    minio.fileExists.mockResolvedValue(false);
    const generator = buildGenerator();
    const handler = new DownloadInvoiceHandler(
      prisma as never,
      generator as never,
      minio as never,
      buildTenant() as never,
      buildConfig() as never,
    );

    await handler.execute('inv-1');

    expect(generator.execute).toHaveBeenCalledWith('inv-1');
  });
});
