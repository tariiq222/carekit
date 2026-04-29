import { Injectable, NotFoundException, BadRequestException, ServiceUnavailableException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { ZatcaSubmissionStatus } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';
import { TenantContextService } from '../../../common/tenant';
import { ZatcaSubmitDto } from './zatca-submit.dto';

export type ZatcaSubmitCommand = ZatcaSubmitDto;

interface ZatcaApiResponse {
  uuid: string;
  status: 'SUBMITTED' | 'ACCEPTED' | 'REJECTED';
  qrCode?: string;
  errors?: string[];
}

/**
 * Submits an invoice to ZATCA Phase 2 e-invoicing API.
 * Owner-only regulated slice — never modify XML structure without compliance review.
 * Idempotent: if already submitted with ACCEPTED status, returns existing record.
 */
@Injectable()
export class ZatcaSubmitHandler {
  private readonly logger = new Logger(ZatcaSubmitHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly tenant: TenantContextService,
  ) {}

  async execute(cmd: ZatcaSubmitCommand) {
    // ZATCA Phase-2 UBL 2.1 XML builder is a stub — disabled until post-launch.
    // Flip ZATCA_ENABLED=true only once buildInvoiceXml is completed and
    // reviewed by compliance. Tracked in issues/ZATCA-XML.
    if (this.config.get<string>('ZATCA_ENABLED') !== 'true') {
      throw new ServiceUnavailableException('ZATCA e-invoicing is not yet enabled on this deployment');
    }
    const organizationId = this.tenant.requireOrganizationIdOrDefault();
    // Proxy auto-scopes findFirst by organizationId via CLS
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: cmd.invoiceId },
    });
    if (!invoice) {
      throw new NotFoundException(`Invoice ${cmd.invoiceId} not found`);
    }
    if (invoice.status !== 'PAID') {
      throw new BadRequestException(`Invoice must be PAID before ZATCA submission (status: ${invoice.status})`);
    }

    // findFirst — Proxy auto-scopes by organizationId via CLS
    const existing = await this.prisma.zatcaSubmission.findFirst({
      where: { invoiceId: cmd.invoiceId },
    });
    if (existing?.status === ZatcaSubmissionStatus.ACCEPTED) return existing;

    const xml = this.buildInvoiceXml(invoice);
    const xmlHash = createHash('sha256').update(xml).digest('hex');

    let submission = existing
      ? await this.prisma.zatcaSubmission.update({
          where: { invoiceId: cmd.invoiceId },
          data: { status: ZatcaSubmissionStatus.PENDING, xmlHash, submittedAt: new Date() },
        })
      : await this.prisma.zatcaSubmission.create({
          data: {
            organizationId,
            invoiceId: cmd.invoiceId,
            status: ZatcaSubmissionStatus.PENDING,
            xmlHash,
            submittedAt: new Date(),
          },
        });

    const apiResponse = await this.callZatcaApi(xml);

    const finalStatus =
      apiResponse.status === 'ACCEPTED'
        ? ZatcaSubmissionStatus.ACCEPTED
        : apiResponse.status === 'SUBMITTED'
        ? ZatcaSubmissionStatus.SUBMITTED
        : ZatcaSubmissionStatus.REJECTED;

    submission = await this.prisma.zatcaSubmission.update({
      where: { invoiceId: cmd.invoiceId },
      data: {
        status: finalStatus,
        zatcaUuid: apiResponse.uuid,
        qrCode: apiResponse.qrCode,
        responseRaw: apiResponse as object,
      },
    });

    if (finalStatus === ZatcaSubmissionStatus.REJECTED) {
      this.logger.warn(`ZATCA rejected invoice ${cmd.invoiceId}: ${JSON.stringify(apiResponse.errors)}`);
    }

    return submission;
  }

  /**
   * Escapes the five XML predefined entities so interpolated field values
   * cannot break out of their element and inject sibling XML. Mandatory for
   * any field that originates from user input or arbitrary DB content.
   */
  private escapeXml(value: string | number | null | undefined): string {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  // TODO(zatca-xml): Replace stub with full UBL 2.1 / ZATCA Phase-2 XML builder.
  // Tracked in: https://github.com/carekit-hq/carekit/issues/ZATCA-XML
  // Owner: @tariq — do NOT modify XML structure without compliance review.
  private buildInvoiceXml(invoice: { id: string; total: unknown; vatAmt: unknown; issuedAt: Date | null }): string {
    const id = this.escapeXml(invoice.id);
    const vatAmt = this.escapeXml(String(invoice.vatAmt ?? '0'));
    const total = this.escapeXml(String(invoice.total ?? '0'));
    const issueDate = this.escapeXml(
      (invoice.issuedAt ?? new Date()).toISOString().split('T')[0],
    );
    return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2">
  <ID>${id}</ID>
  <TaxTotal><TaxAmount>${vatAmt}</TaxAmount></TaxTotal>
  <LegalMonetaryTotal><TaxInclusiveAmount>${total}</TaxInclusiveAmount></LegalMonetaryTotal>
  <IssueDate>${issueDate}</IssueDate>
</Invoice>`;
  }

  private async callZatcaApi(xml: string): Promise<ZatcaApiResponse> {
    const apiUrl = this.config.get<string>('ZATCA_API_URL');
    const apiKey = this.config.get<string>('ZATCA_API_KEY');

    if (!apiUrl || !apiKey) {
      // Fail-closed: ZATCA_ENABLED=true with missing API config used to return
      // a fake `mock-${Date.now()}` UUID with status SUBMITTED — persisting a
      // compliance lie. Refuse to forge a submission.
      this.logger.error('ZATCA_ENABLED=true but ZATCA_API_URL/ZATCA_API_KEY are missing — refusing to forge a submission');
      throw new ServiceUnavailableException('ZATCA API credentials are not configured');
    }

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/xml', Authorization: `Bearer ${apiKey}` },
      body: xml,
    });

    if (!response.ok) {
      throw new BadRequestException(`ZATCA API error: ${response.status} ${response.statusText}`);
    }

    return response.json() as Promise<ZatcaApiResponse>;
  }
}
