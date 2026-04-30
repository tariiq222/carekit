import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import { MinioService } from '../../../../infrastructure/storage/minio.service';
import { TenantContextService } from '../../../../common/tenant/tenant-context.service';
import { PdfRendererService } from './pdf-renderer.service';
import { encodeZatcaQr } from './zatca-qr.util';

/**
 * Phase 7 — render an invoice's PDF, upload to MinIO, persist
 * `pdfStorageKey`. Idempotent: if the storage key is set and the object
 * exists in MinIO the handler returns immediately without regenerating.
 *
 * VAT semantics: `invoice.amount` is the VAT-inclusive total Moyasar
 * already charged. The PDF derives subtotal/VAT for display (and the
 * ZATCA QR Tag 4/5 fields) by dividing by 1.15. Charging logic does
 * NOT change in Phase 7.
 *
 * Tenant isolation: `SubscriptionInvoice` is intentionally not in
 * `SCOPED_MODELS`. Every query filters `organizationId` explicitly;
 * cross-org access returns 404 (not 403).
 */
@Injectable()
export class GenerateInvoicePdfHandler {
  private readonly bucket: string;
  private readonly platformNameAr: string;
  private readonly platformVatNumber: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly renderer: PdfRendererService,
    private readonly minio: MinioService,
    private readonly tenant: TenantContextService,
    config: ConfigService,
  ) {
    this.bucket =
      config.get<string>('MINIO_INVOICE_BUCKET') ??
      config.getOrThrow<string>('MINIO_BUCKET');
    this.platformNameAr = config.getOrThrow<string>('PLATFORM_COMPANY_NAME_AR');
    this.platformVatNumber = config.getOrThrow<string>('PLATFORM_VAT_NUMBER');
  }

  async execute(invoiceId: string): Promise<{ key: string }> {
    const organizationId = this.tenant.requireOrganizationId();
    const invoice = await this.prisma.subscriptionInvoice.findFirst({
      where: { id: invoiceId, organizationId },
      include: {
        subscription: { include: { plan: true, organization: true } },
      },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    if (!invoice.issuedAt || !invoice.invoiceNumber) {
      throw new BadRequestException('Invoice not yet issued');
    }

    if (
      invoice.pdfStorageKey &&
      (await this.minio.fileExists(this.bucket, invoice.pdfStorageKey))
    ) {
      return { key: invoice.pdfStorageKey };
    }

    const org = invoice.subscription.organization;

    const total = Number(invoice.amount);
    const subtotal = Math.round((total / 1.15) * 100) / 100;
    const vat = Math.round((total - subtotal) * 100) / 100;

    const totalStr = total.toFixed(2);
    const subtotalStr = subtotal.toFixed(2);
    const vatStr = vat.toFixed(2);

    const qrBase64 = encodeZatcaQr({
      sellerName: this.platformNameAr,
      vatNumber: this.platformVatNumber,
      timestampIso: invoice.issuedAt.toISOString(),
      totalWithVat: totalStr,
      vatAmount: vatStr,
    });

    const lineItemsJson = (invoice.lineItems ?? []) as Array<{
      description?: string;
      amount?: number | string;
    }>;
    const lineItems = lineItemsJson.map(l => ({
      description: l.description ?? '',
      amount: Number(l.amount ?? 0).toFixed(2),
    }));

    const buffer = await this.renderer.render({
      invoiceNumber: invoice.invoiceNumber,
      issuedAtIso: invoice.issuedAt.toISOString(),
      organizationName: org.nameAr,
      vatNumber: null,
      planName: invoice.subscription.plan.nameAr,
      periodStart: invoice.periodStart.toISOString().slice(0, 10),
      periodEnd: invoice.periodEnd.toISOString().slice(0, 10),
      lineItems,
      subtotal: subtotalStr,
      vatAmount: vatStr,
      total: totalStr,
      currency: invoice.currency,
      qrBase64,
      invoiceHash: invoice.invoiceHash ?? '',
    });

    const key = `invoices/${organizationId}/${invoiceId}.pdf`;
    await this.minio.uploadFile(this.bucket, key, buffer, 'application/pdf');
    await this.prisma.subscriptionInvoice.update({
      where: { id: invoiceId },
      data: { pdfStorageKey: key },
    });
    return { key };
  }
}
