import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service.js';
import { ZatcaService } from '../zatca.service.js';
import { ZatcaApiService } from './zatca-api.service.js';
import { InvoiceHashService } from './invoice-hash.service.js';
import type { ZatcaSandboxResult } from '../dto/zatca-sandbox.dto.js';

@Injectable()
export class ZatcaSandboxService {
  private readonly logger = new Logger(ZatcaSandboxService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly zatcaService: ZatcaService,
    private readonly zatcaApiService: ZatcaApiService,
    private readonly hashService: InvoiceHashService,
  ) {}

  /**
   * Reports an existing invoice to the ZATCA sandbox for compliance testing.
   * Requires phase2 config and CSID credentials stored in WhiteLabelConfig.
   */
  async reportInvoiceToSandbox(invoiceId: string): Promise<ZatcaSandboxResult> {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      select: {
        id: true,
        invoiceNumber: true,
        xmlContent: true,
        invoiceHash: true,
        zatcaStatus: true,
      },
    });

    if (!invoice) {
      throw new NotFoundException({ statusCode: 404, message: `Invoice ${invoiceId} not found`, error: 'NOT_FOUND' });
    }

    if (!invoice.xmlContent || !invoice.invoiceHash) {
      throw new BadRequestException(
        'Invoice missing XML content or hash — re-generate with Phase 2 config',
      );
    }

    const credentials = await this.loadCredentials();

    const xmlBase64 = Buffer.from(invoice.xmlContent).toString('base64');

    this.logger.log(`Reporting invoice ${invoice.invoiceNumber} to ZATCA sandbox`);

    const response = await this.zatcaApiService.reportInvoice(
      {
        invoiceHash: invoice.invoiceHash,
        uuid: invoice.id,
        invoice: xmlBase64,
      },
      credentials,
    );

    const succeeded =
      response.reportingStatus === 'REPORTED' ||
      response.validationResults?.status === 'PASS';

    await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        zatcaStatus: succeeded ? 'reported' : 'failed',
        sentAt: succeeded ? new Date() : undefined,
        zatcaResponse: JSON.parse(JSON.stringify(response)),
      },
    });

    this.logger.log(
      `Invoice ${invoice.invoiceNumber} sandbox result: ${response.reportingStatus ?? response.status}`,
    );

    return {
      success: succeeded,
      status: response.status,
      reportingStatus: response.reportingStatus,
      validationResults: response.validationResults as ZatcaSandboxResult['validationResults'],
      message: succeeded
        ? 'Invoice reported successfully to ZATCA sandbox'
        : 'Invoice reporting failed — check validation results',
    };
  }

  /**
   * Loads CSID + secret from WhiteLabelConfig for sandbox authentication.
   */
  private async loadCredentials(): Promise<{ csid: string; secret: string }> {
    const configs = await this.prisma.whiteLabelConfig.findMany({
      where: { key: { in: ['zatca_csid', 'zatca_secret'] } },
      select: { key: true, value: true },
    });

    const map = Object.fromEntries(configs.map((c) => [c.key, c.value]));

    if (!map['zatca_csid'] || !map['zatca_secret']) {
      throw new BadRequestException(
        'ZATCA CSID credentials not configured — set zatca_csid and zatca_secret in WhiteLabel settings',
      );
    }

    return { csid: map['zatca_csid'], secret: map['zatca_secret'] };
  }

  /**
   * Returns ZATCA reporting stats for the dashboard.
   */
  async getSandboxStats(): Promise<{
    pending: number;
    reported: number;
    failed: number;
    notApplicable: number;
  }> {
    const counts = await this.prisma.invoice.groupBy({
      by: ['zatcaStatus'],
      _count: { _all: true },
    });

    const map = Object.fromEntries(
      counts.map((c) => [c.zatcaStatus ?? 'not_applicable', c._count._all]),
    );

    return {
      pending: map['pending'] ?? 0,
      reported: map['reported'] ?? 0,
      failed: map['failed'] ?? 0,
      notApplicable: map['not_applicable'] ?? 0,
    };
  }
}
