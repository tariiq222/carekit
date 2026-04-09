import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, OnModuleInit } from '@nestjs/common';
import { Job, UnrecoverableError } from 'bullmq';
import { PrismaService } from '../../../database/prisma.service.js';
import { ClinicIntegrationsService } from '../../clinic-integrations/clinic-integrations.service.js';
import { ZatcaApiService } from './zatca-api.service.js';
import { XmlSigningService } from './xml-signing.service.js';
import { InvoiceHashService } from './invoice-hash.service.js';
import { QueueFailureService } from '../../../common/queue/queue-failure.service.js';
import { JOB_ATTEMPTS, QUEUE_ZATCA_SUBMIT } from '../../../config/constants/queues.js';

export interface ZatcaSubmitJobData {
  invoiceId: string;
}

@Processor(QUEUE_ZATCA_SUBMIT)
export class ZatcaSubmitProcessor extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(ZatcaSubmitProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly clinicIntegrationsService: ClinicIntegrationsService,
    private readonly apiService: ZatcaApiService,
    private readonly signingService: XmlSigningService,
    private readonly hashService: InvoiceHashService,
    private readonly queueFailureService: QueueFailureService,
  ) {
    super();
  }

  onModuleInit() {
    this.worker.on('failed', async (job, error) => {
      const isFinal =
        (job && job.attemptsMade >= (job.opts.attempts ?? JOB_ATTEMPTS)) ||
        error.name === 'UnrecoverableError';
      if (isFinal) {
        await this.queueFailureService.notifyAdminsOfFailure(
          QUEUE_ZATCA_SUBMIT,
          job?.name ?? 'unknown',
          job?.id,
          job?.data,
          error,
        );
      }
    });
  }

  async process(job: Job<ZatcaSubmitJobData>): Promise<void> {
    const { invoiceId } = job.data;
    this.logger.log(`Processing ZATCA submission for invoice ${invoiceId}`);

    const invoice = await this.findInvoice(invoiceId);
    if (!invoice) return;

    if (invoice.zatcaStatus === 'reported') {
      this.logger.log(`Invoice ${invoiceId} already reported — skipping`);
      return;
    }

    const credentials = await this.loadCredentials();

    // Sign the XML
    const signedXml = await this.signingService.signXml(invoice.xmlContent);
    const xmlBase64 = Buffer.from(signedXml).toString('base64');

    // Recompute hash of the signed XML
    const signedHash = this.hashService.toBase64(
      this.hashService.hashXml(signedXml),
    );

    // Submit to ZATCA
    const response = await this.apiService.reportInvoice(
      { invoiceHash: signedHash, uuid: invoice.id, invoice: xmlBase64 },
      credentials,
    );

    const succeeded =
      response.reportingStatus === 'REPORTED' ||
      response.validationResults?.status === 'PASS';

    await this.updateInvoice(invoiceId, succeeded, signedXml, response);

    if (!succeeded) {
      this.logger.error(
        `ZATCA submission failed for ${invoiceId}: ${JSON.stringify(response.validationResults?.errorMessages)}`,
      );
      throw new Error('ZATCA submission failed'); // Triggers retry
    }

    this.logger.log(`Invoice ${invoiceId} reported to ZATCA successfully`);
  }

  private async findInvoice(invoiceId: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      select: {
        id: true,
        xmlContent: true,
        invoiceHash: true,
        zatcaStatus: true,
      },
    });

    if (!invoice || !invoice.xmlContent) {
      this.logger.warn(
        `Invoice ${invoiceId} not found or missing XML — skipping`,
      );
      return null;
    }

    return invoice as {
      id: string;
      xmlContent: string;
      invoiceHash: string | null;
      zatcaStatus: string;
    };
  }

  private async loadCredentials(): Promise<{
    csid: string;
    secret: string;
  }> {
    const integrations = await this.clinicIntegrationsService.getRaw();

    if (!integrations.zatcaCsid || !integrations.zatcaSecret) {
      this.logger.error('ZATCA credentials not configured — cannot submit');
      throw new UnrecoverableError('ZATCA credentials missing');
    }

    return {
      csid: integrations.zatcaCsid,
      secret: integrations.zatcaSecret,
    };
  }

  private async updateInvoice(
    invoiceId: string,
    succeeded: boolean,
    signedXml: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    response: Record<string, any>,
  ): Promise<void> {
    await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        zatcaStatus: succeeded ? 'reported' : 'failed',
        sentAt: succeeded ? new Date() : undefined,
        zatcaResponse: JSON.parse(JSON.stringify(response)),
        xmlContent: signedXml,
      },
    });
  }
}
