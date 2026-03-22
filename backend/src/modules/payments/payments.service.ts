import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { MoyasarPaymentService } from './moyasar-payment.service.js';
import { BankTransferService } from './bank-transfer.service.js';
import { CreatePaymentDto } from './dto/create-payment.dto.js';
import { UpdatePaymentStatusDto } from './dto/update-payment-status.dto.js';
import { UploadReceiptDto } from './dto/upload-receipt.dto.js';
import { ReviewReceiptDto } from './dto/review-receipt.dto.js';
import { PaymentFilterDto } from './dto/payment-filter.dto.js';
import { CreateMoyasarPaymentDto } from './dto/create-moyasar-payment.dto.js';
import { MoyasarWebhookDto } from './dto/moyasar-webhook.dto.js';
import { RefundDto } from './dto/refund.dto.js';
import { paymentInclude } from './payments.helpers.js';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly moyasarService: MoyasarPaymentService,
    private readonly bankTransferService: BankTransferService,
  ) {}

  // --- Core ---

  async findAll(query: PaymentFilterDto) {
    const page = query.page ?? 1;
    const perPage = query.perPage ?? 20;
    const skip = (page - 1) * perPage;

    const where: Record<string, unknown> = {};

    if (query.status) where.status = query.status;
    if (query.method) where.method = query.method;
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
      meta: { total, page, perPage, totalPages: Math.ceil(total / perPage) },
    };
  }

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

    return this.prisma.payment.create({
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
  }

  async updateStatus(id: string, dto: UpdatePaymentStatusDto) {
    const payment = await this.prisma.payment.findUnique({ where: { id } });
    if (!payment) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Payment not found',
        error: 'NOT_FOUND',
      });
    }

    return this.prisma.payment.update({
      where: { id },
      data: {
        status: dto.status,
        ...(dto.moyasarPaymentId !== undefined && { moyasarPaymentId: dto.moyasarPaymentId }),
        ...(dto.transactionRef !== undefined && { transactionRef: dto.transactionRef }),
      },
      include: paymentInclude,
    });
  }

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

  async getPaymentStats() {
    const [total, paid, pending, failed, refunded, revenueAgg] = await Promise.all([
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
      total, paid, pending, failed, refunded,
      totalRevenue: revenueAgg._sum.totalAmount ?? 0,
    };
  }

  async getMyPayments(userId: string, query: PaymentFilterDto) {
    const page = query.page ?? 1;
    const perPage = query.perPage ?? 20;
    const skip = (page - 1) * perPage;

    const where: Record<string, unknown> = {
      booking: { patientId: userId },
    };

    if (query.status) where.status = query.status;
    if (query.method) where.method = query.method;
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
      meta: { total, page, perPage, totalPages: Math.ceil(total / perPage) },
    };
  }

  // --- Delegated: Moyasar ---

  async createMoyasarPayment(userId: string, dto: CreateMoyasarPaymentDto) {
    return this.moyasarService.createMoyasarPayment(userId, dto);
  }

  async handleMoyasarWebhook(signature: string, rawBody: Buffer, dto: MoyasarWebhookDto) {
    return this.moyasarService.handleMoyasarWebhook(signature, rawBody, dto);
  }

  async refund(paymentId: string, dto: RefundDto) {
    return this.moyasarService.refund(paymentId, dto.amount);
  }

  // --- Delegated: Bank Transfer ---

  async uploadReceipt(paymentId: string, dto: UploadReceiptDto) {
    return this.bankTransferService.uploadReceipt(paymentId, dto);
  }

  async reviewReceipt(receiptId: string, reviewerId: string, dto: ReviewReceiptDto) {
    return this.bankTransferService.reviewReceipt(receiptId, reviewerId, dto);
  }

  async uploadBankTransferReceipt(userId: string, bookingId: string, file: Express.Multer.File) {
    return this.bankTransferService.uploadBankTransferReceipt(userId, bookingId, file);
  }

  async verifyBankTransfer(
    receiptId: string,
    adminId: string,
    dto: { action: 'approve' | 'reject'; adminNotes?: string },
  ) {
    return this.bankTransferService.verifyBankTransfer(receiptId, adminId, dto);
  }
}
