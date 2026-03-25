import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import * as crypto from 'crypto';
import { PrismaService } from '../../database/prisma.service.js';
import { MinioService } from '../../common/services/minio.service.js';
import { InvoiceCreatorService } from '../invoices/invoice-creator.service.js';
import { BookingStatusService } from '../bookings/booking-status.service.js';
import { ActivityLogService } from '../activity-log/activity-log.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { UploadReceiptDto } from './dto/upload-receipt.dto.js';
import { paymentInclude, bookingWithPriceInclude, calculateAmounts } from './payments.helpers.js';
import { correlationStorage } from '../../common/middleware/correlation-id.middleware.js';

const MINIO_BUCKET = 'carekit';

@Injectable()
export class BankTransferService {
  private readonly logger = new Logger(BankTransferService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly minioService: MinioService,
    private readonly invoicesService: InvoiceCreatorService,
    private readonly bookingStatusService: BookingStatusService,
    private readonly activityLogService: ActivityLogService,
    private readonly notificationsService: NotificationsService,
    @Optional()
    @InjectQueue('receipt-verification')
    private readonly receiptQueue?: Queue,
  ) {}

  async uploadReceipt(paymentId: string, dto: UploadReceiptDto) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
    });
    if (!payment) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Payment not found',
        error: 'NOT_FOUND',
      });
    }

    if (payment.method !== 'bank_transfer') {
      throw new BadRequestException({
        statusCode: 400,
        message: 'Receipts can only be uploaded for bank transfer payments',
        error: 'INVALID_PAYMENT_METHOD',
      });
    }

    return this.prisma.bankTransferReceipt.create({
      data: {
        paymentId,
        receiptUrl: dto.receiptUrl,
        aiVerificationStatus: 'pending',
      },
    });
  }

  async uploadBankTransferReceipt(
    userId: string,
    bookingId: string,
    file: Express.Multer.File,
  ) {
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, deletedAt: null },
      include: bookingWithPriceInclude,
    });
    if (!booking) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Booking not found',
        error: 'NOT_FOUND',
      });
    }

    const existingPayment = await this.prisma.payment.findUnique({
      where: { bookingId },
    });

    const switchableStatuses = ['failed', 'pending', 'awaiting'];
    if (existingPayment && !switchableStatuses.includes(existingPayment.status)) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'Payment already exists for this booking',
        error: 'DUPLICATE_PAYMENT',
      });
    }
    // Clean up previous incomplete/failed payment to allow method switch
    if (existingPayment) {
      await this.prisma.payment.delete({ where: { id: existingPayment.id } });
    }

    const { amount, vatAmount, totalAmount } = calculateAmounts(booking);

    const originalName = file.originalname ?? 'receipt';
    const lastDot = originalName.lastIndexOf('.');
    const extension = lastDot !== -1 ? originalName.slice(lastDot + 1) : 'jpg';
    const objectName = `receipts/${crypto.randomUUID()}.${extension}`;

    const receiptUrl = await this.minioService.uploadFile(
      MINIO_BUCKET,
      objectName,
      file.buffer,
      file.mimetype ?? 'image/jpeg',
    );

    const result = await this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          bookingId,
          amount,
          vatAmount,
          totalAmount,
          method: 'bank_transfer',
          status: 'pending',
        },
        include: paymentInclude,
      });

      const receipt = await tx.bankTransferReceipt.create({
        data: {
          paymentId: payment.id,
          receiptUrl,
          aiVerificationStatus: 'pending',
        },
      });

      return { payment, receipt };
    });

    if (this.receiptQueue) {
      await this.receiptQueue.add('verify', {
        receiptId: result.receipt.id,
        receiptUrl,
        correlationId: correlationStorage.getStore() ?? null,
      });
      this.logger.log(
        `Enqueued receipt verification job for receipt ${result.receipt.id}`,
      );
    }

    return result;
  }

  async verifyBankTransfer(
    receiptId: string,
    adminId: string,
    dto: { action: 'approve' | 'reject'; adminNotes?: string },
  ) {
    const receipt = await this.prisma.bankTransferReceipt.findUnique({
      where: { id: receiptId },
    });
    if (!receipt) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Receipt not found',
        error: 'NOT_FOUND',
      });
    }

    const newStatus = dto.action === 'approve' ? 'approved' : 'rejected';

    await this.prisma.$transaction(async (tx) => {
      await tx.bankTransferReceipt.update({
        where: { id: receiptId },
        data: {
          aiVerificationStatus: newStatus,
          reviewedById: adminId,
          reviewedAt: new Date(),
          adminNotes: dto.adminNotes,
        },
      });

      if (dto.action === 'approve') {
        await tx.payment.update({
          where: { id: receipt.paymentId },
          data: { status: 'paid' },
        });
      }
    });

    const payment = await this.prisma.payment.findUnique({
      where: { id: receipt.paymentId },
      include: { booking: { select: { patientId: true } } },
    });

    if (dto.action === 'approve' && payment?.bookingId) {
      try {
        await this.bookingStatusService.confirm(payment.bookingId);
      } catch (err) {
        this.logger.warn(
          `Auto-confirm skipped for booking: ${err instanceof Error ? err.message : 'unknown'}`,
        );
      }
    }

    if (dto.action === 'reject' && payment?.bookingId) {
      await this.handleRejectedTransfer(payment.bookingId, payment.booking?.patientId, dto.adminNotes);
    }

    this.activityLogService.log({
      userId: adminId,
      action: dto.action === 'approve' ? 'receipt_approved' : 'receipt_rejected',
      module: 'payments',
      resourceId: receiptId,
      description: `Bank transfer receipt ${dto.action}d by admin`,
    }).catch(() => {});

    if (dto.action === 'approve') {
      try {
        await this.invoicesService.createInvoice({ paymentId: receipt.paymentId });
      } catch (err) {
        if (!(err instanceof ConflictException)) {
          this.logger.error(`Invoice creation failed for payment ${receipt.paymentId}`, err);
        }
      }
    }

    return this.prisma.payment.findUnique({
      where: { id: receipt.paymentId },
      include: paymentInclude,
    });
  }

  // ───────────────────────────────────────────────────────────────
  //  Private: Handle rejected bank transfer
  // ───────────────────────────────────────────────────────────────

  private async handleRejectedTransfer(
    bookingId: string,
    patientId: string | null | undefined,
    reason?: string,
  ): Promise<void> {
    // Delete the rejected payment so patient can retry with a new receipt
    await this.prisma.payment.deleteMany({
      where: { bookingId, status: { in: ['pending', 'failed'] } },
    });

    if (!patientId) return;

    const reasonText = reason ? ` (${reason})` : '';
    await this.notificationsService.createNotification({
      userId: patientId,
      titleAr: 'تم رفض إيصال التحويل البنكي',
      titleEn: 'Bank Transfer Receipt Rejected',
      bodyAr: `تم رفض إيصال التحويل البنكي${reasonText}. يمكنك رفع إيصال جديد أو اختيار طريقة دفع أخرى`,
      bodyEn: `Your bank transfer receipt was rejected${reasonText}. You can upload a new receipt or choose another payment method`,
      type: 'receipt_rejected',
      data: { bookingId },
    });
  }
}
