import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../../database/prisma.service.js';
import { MinioService } from '../../common/services/minio.service.js';
import { InvoiceCreatorService } from '../invoices/invoice-creator.service.js';
import { UploadReceiptDto } from './dto/upload-receipt.dto.js';
import { ReviewReceiptDto } from './dto/review-receipt.dto.js';
import { paymentInclude, bookingWithPriceInclude, calculateAmounts } from './payments.helpers.js';

const MINIO_BUCKET = 'carekit';

@Injectable()
export class BankTransferService {
  private readonly logger = new Logger(BankTransferService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly minioService: MinioService,
    private readonly invoicesService: InvoiceCreatorService,
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

  async reviewReceipt(receiptId: string, reviewerId: string, dto: ReviewReceiptDto) {
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

    const newStatus = dto.approved ? 'approved' : 'rejected';

    const updatedReceipt = await this.prisma.bankTransferReceipt.update({
      where: { id: receiptId },
      data: {
        aiVerificationStatus: newStatus,
        adminNotes: dto.adminNotes,
        reviewedById: reviewerId,
        reviewedAt: new Date(),
      },
    });

    if (dto.approved) {
      await this.prisma.payment.update({
        where: { id: receipt.paymentId },
        data: { status: 'paid' },
      });
    }

    return updatedReceipt;
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
    if (existingPayment) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'Payment already exists for this booking',
        error: 'DUPLICATE_PAYMENT',
      });
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
}
