import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service.js';
import { MinioService } from '../../common/services/minio.service.js';
import { InvoiceCreatorService } from '../invoices/invoice-creator.service.js';
import { CreatePaymentDto } from './dto/create-payment.dto.js';
import { UpdatePaymentStatusDto } from './dto/update-payment-status.dto.js';
import { UploadReceiptDto } from './dto/upload-receipt.dto.js';
import { ReviewReceiptDto } from './dto/review-receipt.dto.js';
import { PaymentFilterDto } from './dto/payment-filter.dto.js';
import { CreateMoyasarPaymentDto } from './dto/create-moyasar-payment.dto.js';
import { MoyasarWebhookDto } from './dto/moyasar-webhook.dto.js';
import { RefundDto } from './dto/refund.dto.js';

const MINIO_BUCKET = 'carekit';

const paymentInclude = {
  booking: {
    include: {
      patient: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
        },
      },
      practitioner: {
        include: {
          user: { select: { id: true, firstName: true, lastName: true } },
          specialty: { select: { nameEn: true, nameAr: true } },
        },
      },
    },
  },
  receipt: true,
  invoice: true,
};

const bookingWithPriceInclude = {
  practitioner: true,
  service: true,
};

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly minioService: MinioService,
    private readonly invoicesService: InvoiceCreatorService,
    private readonly config: ConfigService,
  ) {}

  // ═══════════════════════════════════════════════════════════════
  //  PRIVATE HELPERS
  // ═══════════════════════════════════════════════════════════════

  private calculateAmounts(booking: {
    type: string;
    practitioner: { priceClinic: number; pricePhone: number; priceVideo: number } | null;
    service: { price: number } | null;
  }): { amount: number; vatAmount: number; totalAmount: number } {
    let amount = 0;

    if (booking.practitioner) {
      if (booking.type === 'clinic_visit') {
        amount = booking.practitioner.priceClinic;
      } else if (booking.type === 'phone_consultation') {
        amount = booking.practitioner.pricePhone;
      } else if (booking.type === 'video_consultation') {
        amount = booking.practitioner.priceVideo;
      }
    }

    // Fall back to service price if practitioner price is zero
    if (amount === 0 && booking.service) {
      amount = booking.service.price;
    }

    const vatAmount = Math.round(amount * 0.15);
    const totalAmount = amount + vatAmount;

    return { amount, vatAmount, totalAmount };
  }

  // ═══════════════════════════════════════════════════════════════
  //  FIND ALL (paginated + filters)
  // ═══════════════════════════════════════════════════════════════

  async findAll(query: PaymentFilterDto) {
    const page = query.page ?? 1;
    const perPage = query.perPage ?? 20;
    const skip = (page - 1) * perPage;

    const where: Record<string, unknown> = {};

    if (query.status) {
      where.status = query.status;
    }
    if (query.method) {
      where.method = query.method;
    }
    if (query.dateFrom || query.dateTo) {
      const dateFilter: Record<string, Date> = {};
      if (query.dateFrom) {
        dateFilter.gte = new Date(query.dateFrom);
      }
      if (query.dateTo) {
        dateFilter.lte = new Date(query.dateTo);
      }
      where.createdAt = dateFilter;
    }

    const [items, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        include: paymentInclude,
        orderBy: { createdAt: 'desc' },
        skip,
        take: perPage,
      }),
      this.prisma.payment.count({ where }),
    ]);

    const totalPages = Math.ceil(total / perPage);

    return {
      data: items,
      meta: {
        total,
        page,
        perPage,
        totalPages,
      },
    };
  }

  // ═══════════════════════════════════════════════════════════════
  //  FIND ONE
  // ═══════════════════════════════════════════════════════════════

  async findOne(id: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: paymentInclude,
    });
    if (!payment) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Payment not found',
        error: 'NOT_FOUND',
      });
    }
    return payment;
  }

  // ═══════════════════════════════════════════════════════════════
  //  CREATE PAYMENT (legacy manual method)
  // ═══════════════════════════════════════════════════════════════

  async createPayment(dto: CreatePaymentDto) {
    const booking = await this.prisma.booking.findFirst({
      where: { id: dto.bookingId, deletedAt: null },
    });
    if (!booking) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Booking not found',
        error: 'NOT_FOUND',
      });
    }

    const existingPayment = await this.prisma.payment.findUnique({
      where: { bookingId: dto.bookingId },
    });
    if (existingPayment) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'Payment already exists for this booking',
        error: 'DUPLICATE_PAYMENT',
      });
    }

    const payment = await this.prisma.payment.create({
      data: {
        bookingId: dto.bookingId,
        amount: dto.amount,
        vatAmount: 0,
        totalAmount: dto.amount,
        method: dto.method,
        status: 'pending',
      },
      include: paymentInclude,
    });

    return payment;
  }

  // ═══════════════════════════════════════════════════════════════
  //  UPDATE STATUS
  // ═══════════════════════════════════════════════════════════════

  async updateStatus(id: string, dto: UpdatePaymentStatusDto) {
    const payment = await this.prisma.payment.findUnique({ where: { id } });
    if (!payment) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Payment not found',
        error: 'NOT_FOUND',
      });
    }

    const updated = await this.prisma.payment.update({
      where: { id },
      data: {
        status: dto.status,
        ...(dto.moyasarPaymentId !== undefined && {
          moyasarPaymentId: dto.moyasarPaymentId,
        }),
        ...(dto.transactionRef !== undefined && {
          transactionRef: dto.transactionRef,
        }),
      },
      include: paymentInclude,
    });

    return updated;
  }

  // ═══════════════════════════════════════════════════════════════
  //  UPLOAD RECEIPT (legacy — bank_transfer only)
  // ═══════════════════════════════════════════════════════════════

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

    const receipt = await this.prisma.bankTransferReceipt.create({
      data: {
        paymentId,
        receiptUrl: dto.receiptUrl,
        aiVerificationStatus: 'pending',
      },
    });

    return receipt;
  }

  // ═══════════════════════════════════════════════════════════════
  //  REVIEW RECEIPT (legacy — admin approves / rejects)
  // ═══════════════════════════════════════════════════════════════

  async reviewReceipt(
    receiptId: string,
    reviewerId: string,
    dto: ReviewReceiptDto,
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

  // ═══════════════════════════════════════════════════════════════
  //  FIND PAYMENT BY BOOKING
  // ═══════════════════════════════════════════════════════════════

  async findPaymentByBooking(bookingId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { bookingId },
      include: paymentInclude,
    });
    if (!payment) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Payment not found for this booking',
        error: 'NOT_FOUND',
      });
    }
    return payment;
  }

  // ═══════════════════════════════════════════════════════════════
  //  GET PAYMENT STATS
  // ═══════════════════════════════════════════════════════════════

  async getPaymentStats() {
    const [total, paid, pending, failed, refunded, revenueAgg] =
      await Promise.all([
        this.prisma.payment.count(),
        this.prisma.payment.count({ where: { status: 'paid' } }),
        this.prisma.payment.count({ where: { status: 'pending' } }),
        this.prisma.payment.count({ where: { status: 'failed' } }),
        this.prisma.payment.count({ where: { status: 'refunded' } }),
        this.prisma.payment.aggregate({
          _sum: { totalAmount: true },
          where: { status: 'paid' },
        }),
      ]);

    return {
      total,
      paid,
      pending,
      failed,
      refunded,
      totalRevenue: revenueAgg._sum.totalAmount ?? 0,
    };
  }

  // ═══════════════════════════════════════════════════════════════
  //  GET MY PAYMENTS (patient-scoped)
  // ═══════════════════════════════════════════════════════════════

  async getMyPayments(userId: string, query: PaymentFilterDto) {
    const page = query.page ?? 1;
    const perPage = query.perPage ?? 20;
    const skip = (page - 1) * perPage;

    const where: Record<string, unknown> = {
      booking: { patientId: userId },
    };

    if (query.status) {
      where.status = query.status;
    }
    if (query.method) {
      where.method = query.method;
    }
    if (query.dateFrom || query.dateTo) {
      const dateFilter: Record<string, Date> = {};
      if (query.dateFrom) dateFilter.gte = new Date(query.dateFrom);
      if (query.dateTo) dateFilter.lte = new Date(query.dateTo);
      where.createdAt = dateFilter;
    }

    const [items, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        include: paymentInclude,
        orderBy: { createdAt: 'desc' },
        skip,
        take: perPage,
      }),
      this.prisma.payment.count({ where }),
    ]);

    return {
      data: items,
      meta: {
        total,
        page,
        perPage,
        totalPages: Math.ceil(total / perPage),
      },
    };
  }

  // ═══════════════════════════════════════════════════════════════
  //  CREATE MOYASAR PAYMENT
  // ═══════════════════════════════════════════════════════════════

  async createMoyasarPayment(userId: string, dto: CreateMoyasarPaymentDto) {
    const booking = await this.prisma.booking.findFirst({
      where: { id: dto.bookingId, deletedAt: null },
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
      where: { bookingId: dto.bookingId },
    });
    if (existingPayment) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'Payment already exists for this booking',
        error: 'DUPLICATE_PAYMENT',
      });
    }

    const { amount, vatAmount, totalAmount } = this.calculateAmounts(booking);

    const apiKey = this.config.get<string>('MOYASAR_API_KEY', '');
    const backendUrl = this.config.get<string>(
      'BACKEND_URL',
      'http://localhost:3000',
    );
    const callbackUrl = `${backendUrl}/api/v1/payments/moyasar/webhook`;

    const credentials = Buffer.from(`${apiKey}:`).toString('base64');

    const moyasarBody = {
      amount: totalAmount,
      currency: 'SAR',
      description: `Booking #${booking.id}`,
      source: dto.source,
      callback_url: callbackUrl,
      metadata: { bookingId: booking.id, userId },
    };

    const response = await fetch('https://api.moyasar.com/v1/payments', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(moyasarBody),
    });

    if (!response.ok) {
      const errorBody = (await response.json().catch(() => ({
        message: 'Unknown error',
      }))) as { message?: string };
      throw new BadRequestException({
        statusCode: 400,
        message: errorBody.message ?? 'Moyasar payment creation failed',
        error: 'MOYASAR_ERROR',
      });
    }

    const moyasarResponse = (await response.json()) as {
      id: string;
      status: string;
      source?: { transaction_url?: string };
    };

    const payment = await this.prisma.payment.create({
      data: {
        bookingId: dto.bookingId,
        amount,
        vatAmount,
        totalAmount,
        method: 'moyasar',
        status: 'pending',
        moyasarPaymentId: moyasarResponse.id,
      },
      include: paymentInclude,
    });

    return {
      payment,
      redirectUrl: moyasarResponse.source?.transaction_url ?? null,
    };
  }

  // ═══════════════════════════════════════════════════════════════
  //  HANDLE MOYASAR WEBHOOK
  // ═══════════════════════════════════════════════════════════════

  async handleMoyasarWebhook(
    signature: string,
    rawBody: Buffer,
    dto: MoyasarWebhookDto,
  ) {
    const secret = this.config.get<string>('MOYASAR_WEBHOOK_SECRET', '');
    const expectedSig = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');

    if (expectedSig !== signature) {
      throw new UnauthorizedException({
        statusCode: 401,
        message: 'Invalid webhook signature',
        error: 'INVALID_SIGNATURE',
      });
    }

    const payment = await this.prisma.payment.findFirst({
      where: { moyasarPaymentId: dto.id },
    });

    if (!payment) {
      // Payment not found — return success to avoid Moyasar retries for unknown IDs
      return { success: true };
    }

    if (dto.status === 'paid') {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: 'paid' },
      });

      // Auto-create invoice
      try {
        await this.invoicesService.createInvoice({ paymentId: payment.id });
      } catch {
        // Invoice may already exist — swallow ConflictException
      }
    } else if (dto.status === 'failed') {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: 'failed' },
      });
    }

    return { success: true };
  }

  // ═══════════════════════════════════════════════════════════════
  //  UPLOAD BANK TRANSFER RECEIPT (with MinIO)
  // ═══════════════════════════════════════════════════════════════

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

    const { amount, vatAmount, totalAmount } = this.calculateAmounts(booking);

    // Determine file extension
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

    const payment = await this.prisma.payment.create({
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

    const receipt = await this.prisma.bankTransferReceipt.create({
      data: {
        paymentId: payment.id,
        receiptUrl,
        aiVerificationStatus: 'pending',
      },
    });

    return { payment, receipt };
  }

  // ═══════════════════════════════════════════════════════════════
  //  VERIFY BANK TRANSFER (admin approve / reject)
  // ═══════════════════════════════════════════════════════════════

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

    await this.prisma.bankTransferReceipt.update({
      where: { id: receiptId },
      data: {
        aiVerificationStatus: newStatus,
        reviewedById: adminId,
        reviewedAt: new Date(),
        adminNotes: dto.adminNotes,
      },
    });

    if (dto.action === 'approve') {
      await this.prisma.payment.update({
        where: { id: receipt.paymentId },
        data: { status: 'paid' },
      });

      // Auto-create invoice
      try {
        await this.invoicesService.createInvoice({ paymentId: receipt.paymentId });
      } catch {
        // Invoice may already exist — swallow ConflictException
      }
    }

    return this.prisma.payment.findUnique({
      where: { id: receipt.paymentId },
      include: paymentInclude,
    });
  }

  // ═══════════════════════════════════════════════════════════════
  //  REFUND
  // ═══════════════════════════════════════════════════════════════

  async refund(paymentId: string, dto: RefundDto) {
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

    if (payment.status !== 'paid') {
      throw new BadRequestException({
        statusCode: 400,
        message: 'Only paid payments can be refunded',
        error: 'INVALID_PAYMENT_STATUS',
      });
    }

    if (payment.method === 'moyasar' && payment.moyasarPaymentId) {
      const apiKey = this.config.get<string>('MOYASAR_API_KEY', '');
      const credentials = Buffer.from(`${apiKey}:`).toString('base64');
      const refundAmount = dto.amount ?? payment.totalAmount;

      const response = await fetch(
        `https://api.moyasar.com/v1/payments/${payment.moyasarPaymentId}/refund`,
        {
          method: 'POST',
          headers: {
            Authorization: `Basic ${credentials}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ amount: refundAmount }),
        },
      );

      if (!response.ok) {
        const errorBody = (await response.json().catch(() => ({
          message: 'Unknown error',
        }))) as { message?: string };
        throw new BadRequestException({
          statusCode: 400,
          message: errorBody.message ?? 'Moyasar refund failed',
          error: 'MOYASAR_REFUND_ERROR',
        });
      }
    }

    return this.prisma.payment.update({
      where: { id: paymentId },
      data: { status: 'refunded' },
      include: paymentInclude,
    });
  }
}
