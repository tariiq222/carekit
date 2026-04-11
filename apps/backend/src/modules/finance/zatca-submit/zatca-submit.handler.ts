import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { ZatcaSubmissionStatus } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';

export interface ZatcaSubmitCommand {
  tenantId: string;
  invoiceId: string;
}

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
  ) {}

  async execute(cmd: ZatcaSubmitCommand) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: cmd.invoiceId },
    });
    if (!invoice || invoice.tenantId !== cmd.tenantId) {
      throw new NotFoundException(`Invoice ${cmd.invoiceId} not found`);
    }
    if (invoice.status !== 'PAID') {
      throw new BadRequestException(`Invoice must be PAID before ZATCA submission (status: ${invoice.status})`);
    }

    const existing = await this.prisma.zatcaSubmission.findUnique({
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
            tenantId: cmd.tenantId,
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

  private buildInvoiceXml(invoice: { id: string; tenantId: string; total: unknown; vatAmt: unknown; issuedAt: Date | null }): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2">
  <ID>${invoice.id}</ID>
  <TaxTotal><TaxAmount>${invoice.vatAmt}</TaxAmount></TaxTotal>
  <LegalMonetaryTotal><TaxInclusiveAmount>${invoice.total}</TaxInclusiveAmount></LegalMonetaryTotal>
  <IssueDate>${(invoice.issuedAt ?? new Date()).toISOString().split('T')[0]}</IssueDate>
</Invoice>`;
  }

  private async callZatcaApi(xml: string): Promise<ZatcaApiResponse> {
    const apiUrl = this.config.get<string>('ZATCA_API_URL');
    const apiKey = this.config.get<string>('ZATCA_API_KEY');

    if (!apiUrl || !apiKey) {
      this.logger.warn('ZATCA_API_URL or ZATCA_API_KEY not configured — skipping real submission');
      return { uuid: `mock-${Date.now()}`, status: 'SUBMITTED' };
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
