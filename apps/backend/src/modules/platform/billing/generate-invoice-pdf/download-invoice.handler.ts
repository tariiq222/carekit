import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import { MinioService } from '../../../../infrastructure/storage/minio.service';
import { TenantContextService } from '../../../../common/tenant/tenant-context.service';
import { GenerateInvoicePdfHandler } from './generate-invoice-pdf.handler';

/**
 * Phase 7 — three-step download resolution:
 *  1. If `pdfStorageKey` is set AND object exists in MinIO → presigned URL.
 *  2. Else if legacy `pdfUrl` already holds a full http(s) URL → passthrough.
 *  3. Else → render via `GenerateInvoicePdfHandler`, then presign.
 *
 * Returns 404 (not 403) for cross-org access — `SubscriptionInvoice` is not
 * in `SCOPED_MODELS` so we filter `organizationId` explicitly.
 */
@Injectable()
export class DownloadInvoiceHandler {
  private readonly bucket: string;
  private readonly signedUrlTtlSeconds = 600;

  constructor(
    private readonly prisma: PrismaService,
    private readonly generator: GenerateInvoicePdfHandler,
    private readonly minio: MinioService,
    private readonly tenant: TenantContextService,
    config: ConfigService,
  ) {
    this.bucket =
      config.get<string>('MINIO_INVOICE_BUCKET') ??
      config.getOrThrow<string>('MINIO_BUCKET');
  }

  async execute(invoiceId: string): Promise<{ url: string }> {
    const organizationId = this.tenant.requireOrganizationId();
    const invoice = await this.prisma.subscriptionInvoice.findFirst({
      where: { id: invoiceId, organizationId },
      select: {
        pdfStorageKey: true,
        pdfUrl: true,
        issuedAt: true,
        invoiceNumber: true,
      },
    });
    if (!invoice) throw new NotFoundException();
    if (!invoice.issuedAt || !invoice.invoiceNumber) {
      throw new BadRequestException('Invoice not yet issued');
    }

    if (
      invoice.pdfStorageKey &&
      (await this.minio.fileExists(this.bucket, invoice.pdfStorageKey))
    ) {
      const url = await this.minio.getSignedUrl(
        this.bucket,
        invoice.pdfStorageKey,
        this.signedUrlTtlSeconds,
      );
      return { url };
    }

    if (invoice.pdfUrl?.startsWith('http')) {
      return { url: invoice.pdfUrl };
    }

    const { key } = await this.generator.execute(invoiceId);
    const url = await this.minio.getSignedUrl(
      this.bucket,
      key,
      this.signedUrlTtlSeconds,
    );
    return { url };
  }
}
