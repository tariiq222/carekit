import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import * as crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { Queue } from 'bullmq';
import { PrismaService } from '../../database/prisma.service.js';
import { ZatcaService } from '../zatca/zatca.service.js';
import { WhitelabelService } from '../whitelabel/whitelabel.service.js';
import { ClinicSettingsService } from '../clinic-settings/clinic-settings.service.js';
import { CreateInvoiceDto } from './dto/create-invoice.dto.js';
import { invoiceInclude } from './invoice.constants.js';
import { buildInvoiceHtml } from './invoice-html.builder.js';
import { correlationStorage } from '../../common/middleware/correlation-id.middleware.js';

@Injectable()
export class InvoiceCreatorService {
  private readonly logger = new Logger(InvoiceCreatorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly zatcaService: ZatcaService,
    private readonly whitelabelService: WhitelabelService,
    private readonly clinicSettingsService: ClinicSettingsService,
    @Optional() @InjectQueue('zatca-submit') private readonly zatcaQueue?: Queue,
  ) {}

  async createInvoice(dto: CreateInvoiceDto) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: dto.paymentId },
      include: {
        booking: {
          include: {
            patient: { select: { firstName: true, lastName: true } },
            service: { select: { nameAr: true, nameEn: true } },
          },
        },
        groupEnrollment: {
          include: {
            patient: { select: { firstName: true, lastName: true } },
            group: { select: { nameAr: true, nameEn: true } },
          },
        },
      },
    });

    if (!payment) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Payment not found',
        error: 'NOT_FOUND',
      });
    }

    if (payment.status !== 'paid') {
      throw new BadRequestException({
        statusCode: 400,
        message: 'Cannot create invoice for an unpaid payment',
        error: 'VALIDATION_ERROR',
      });
    }

    const existing = await this.prisma.invoice.findUnique({
      where: { paymentId: dto.paymentId },
    });

    if (existing) {
      throw new ConflictException({
        statusCode: 409,
        message: 'Invoice already exists for this payment',
        error: 'CONFLICT',
      });
    }

    const invoiceNumber = this.generateInvoiceNumber();
    const now = new Date();
    const issueDate = now.toISOString().split('T')[0];
    const issueTime = now.toTimeString().split(' ')[0];

    const zatcaConfig = await this.zatcaService.loadConfig();

    // Support both booking-based and group-enrollment-based payments
    const hasBooking = payment.booking != null;
    const hasGroupEnrollment = payment.groupEnrollment != null;

    let buyerName: string;
    let serviceDesc: string;

    if (hasBooking) {
      const patient = payment.booking!.patient;
      buyerName = patient ? `${patient.firstName} ${patient.lastName}` : 'مريض';
      serviceDesc =
        payment.booking!.service?.nameAr ??
        payment.booking!.service?.nameEn ??
        'خدمة طبية';
    } else if (hasGroupEnrollment) {
      const patient = payment.groupEnrollment!.patient;
      buyerName = patient ? `${patient.firstName} ${patient.lastName}` : 'مريض';
      serviceDesc =
        payment.groupEnrollment!.group?.nameAr ??
        payment.groupEnrollment!.group?.nameEn ??
        'جلسة جماعية';
    } else {
      buyerName = 'مريض';
      serviceDesc = 'خدمة طبية';
    }

    // ZATCA hash chaining must be atomic: read previous hash + create invoice in a
    // serializable transaction to prevent two concurrent invoices sharing the same previousHash.
    let zatcaDataOuter: Awaited<ReturnType<typeof this.zatcaService.generateForInvoice>>;

    const invoice = await this.prisma.$transaction(async (tx) => {
      // Read the last invoice hash inside the transaction for atomic chaining
      const lastInvoice = await tx.invoice.findFirst({
        where: { invoiceHash: { not: null } },
        orderBy: { createdAt: 'desc' },
        select: { invoiceHash: true },
      }) as { invoiceHash: string | null } | null;
      const previousHash = lastInvoice?.invoiceHash ?? this.zatcaService.zeroHash();

      const zatcaData = await this.zatcaService.generateForInvoice({
        invoiceNumber,
        uuid: uuidv4(),
        issueDate,
        issueTime,
        buyerName,
        serviceDescription: serviceDesc,
        baseAmount: payment.amount,
        previousInvoiceHash: previousHash,
        config: zatcaConfig,
      });
      zatcaDataOuter = zatcaData;

      return tx.invoice.create({
        data: {
          paymentId: dto.paymentId,
          invoiceNumber,
          pdfUrl: null,
          vatAmount: zatcaData.vatAmount,
          vatRate: zatcaData.vatRate,
          invoiceHash: zatcaData.invoiceHash,
          previousHash: zatcaData.previousHash,
          qrCodeData: zatcaData.qrCodeData,
          zatcaStatus: zatcaData.status,
          xmlContent: zatcaData.xmlContent,
        },
        include: invoiceInclude,
      });
    }, { isolationLevel: 'Serializable' });

    // Enqueue ZATCA Phase 2 auto-submit if invoice is pending
    if (this.zatcaQueue && zatcaDataOuter!.status === 'pending') {
      await this.zatcaQueue.add(
        'submit',
        {
          invoiceId: invoice.id,
          correlationId: correlationStorage.getStore() ?? null,
        },
        {
          attempts: 3,
          backoff: { type: 'exponential', delay: 30_000 },
        },
      );
      this.logger.log(`Enqueued ZATCA submit job for invoice ${invoice.id}`);
    }

    return invoice;
  }

  async createGroupInvoice(enrollmentId: string) {
    const enrollment = await this.prisma.groupEnrollment.findUnique({
      where: { id: enrollmentId },
      include: {
        patient: { select: { firstName: true, lastName: true } },
        group: { select: { nameAr: true, nameEn: true } },
        payment: true,
      },
    });

    if (!enrollment?.payment) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Group enrollment payment not found',
        error: 'NOT_FOUND',
      });
    }

    if (enrollment.payment.status !== 'paid') {
      throw new BadRequestException({
        statusCode: 400,
        message: 'Cannot create invoice for an unpaid payment',
        error: 'VALIDATION_ERROR',
      });
    }

    const existing = await this.prisma.invoice.findUnique({
      where: { groupEnrollmentId: enrollmentId },
    });

    if (existing) {
      throw new ConflictException({
        statusCode: 409,
        message: 'Invoice already exists for this group enrollment',
        error: 'CONFLICT',
      });
    }

    const invoiceNumber = this.generateInvoiceNumber();
    const now = new Date();
    const issueDate = now.toISOString().split('T')[0];
    const issueTime = now.toTimeString().split(' ')[0];
    const zatcaConfig = await this.zatcaService.loadConfig();

    const patient = enrollment.patient;
    const buyerName = patient ? `${patient.firstName} ${patient.lastName}` : 'مريض';
    const serviceDesc =
      enrollment.group?.nameAr ??
      enrollment.group?.nameEn ??
      'جلسة جماعية';

    let zatcaDataOuter: Awaited<ReturnType<ZatcaService['generateForInvoice']>>;

    const invoice = await this.prisma.$transaction(async (tx) => {
      const lastInvoice = await tx.invoice.findFirst({
        where: { invoiceHash: { not: null } },
        orderBy: { createdAt: 'desc' },
        select: { invoiceHash: true },
      }) as { invoiceHash: string | null } | null;
      const previousHash = lastInvoice?.invoiceHash ?? this.zatcaService.zeroHash();

      const zatcaData = await this.zatcaService.generateForInvoice({
        invoiceNumber,
        uuid: uuidv4(),
        issueDate,
        issueTime,
        buyerName,
        serviceDescription: serviceDesc,
        baseAmount: enrollment.payment!.amount,
        previousInvoiceHash: previousHash,
        config: zatcaConfig,
      });
      zatcaDataOuter = zatcaData;

      return tx.invoice.create({
        data: {
          groupEnrollmentId: enrollmentId,
          paymentId: enrollment.payment!.id,
          invoiceNumber,
          pdfUrl: null,
          vatAmount: zatcaData.vatAmount,
          vatRate: zatcaData.vatRate,
          invoiceHash: zatcaData.invoiceHash,
          previousHash: zatcaData.previousHash,
          qrCodeData: zatcaData.qrCodeData,
          zatcaStatus: zatcaData.status,
          xmlContent: zatcaData.xmlContent,
        },
        include: invoiceInclude,
      }).catch((e: unknown) => {
        if ((e as { code?: string }).code === 'P2002') {
          throw new ConflictException({
            statusCode: 409,
            message: 'Invoice already exists for this group enrollment',
            error: 'CONFLICT',
          });
        }
        throw e;
      });
    }, { isolationLevel: 'Serializable' });

    if (this.zatcaQueue && zatcaDataOuter!.status === 'pending') {
      await this.zatcaQueue.add(
        'submit',
        {
          invoiceId: invoice.id,
          correlationId: correlationStorage.getStore() ?? null,
        },
        {
          attempts: 3,
          backoff: { type: 'exponential', delay: 30_000 },
        },
      );
      this.logger.log(`Enqueued ZATCA submit job for invoice ${invoice.id}`);
    }

    return invoice;
  }

  async generateInvoiceHtml(id: string): Promise<string> {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: {
        payment: {
          include: {
            booking: {
              include: {
                patient: true,
                practitioner: {
                  include: {
                    user: { select: { id: true, firstName: true, lastName: true } },
                  },
                },
                service: true,
              },
            },
          },
        },
      },
    });

    if (!invoice) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Invoice not found',
        error: 'NOT_FOUND',
      });
    }

    const [branding, settings] = await Promise.all([
      this.whitelabelService.get(),
      this.clinicSettingsService.get(),
    ]);
    const clinicName = branding.systemName ?? 'CareKit Clinic';
    const clinicPhone = settings.contactPhone ?? '';

    return buildInvoiceHtml({ invoice, clinicName, clinicPhone, qrCodeData: invoice.qrCodeData });
  }

  private generateInvoiceNumber(): string {
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    const day = String(now.getUTCDate()).padStart(2, '0');
    const ts = String(now.getTime()).slice(-6);
    const rand = String(crypto.randomInt(1000, 9999));
    return `INV-${year}${month}${day}-${ts}${rand}`;
  }

}
