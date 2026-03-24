import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service.js';
import { InvoiceCreatorService } from '../invoices/invoice-creator.service.js';
import { CreateMoyasarPaymentDto } from './dto/create-moyasar-payment.dto.js';
import { MoyasarWebhookDto } from './dto/moyasar-webhook.dto.js';
import { paymentInclude, bookingWithPriceInclude, calculateAmounts } from './payments.helpers.js';

@Injectable()
export class MoyasarPaymentService {
  private readonly logger = new Logger(MoyasarPaymentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly invoicesService: InvoiceCreatorService,
    private readonly config: ConfigService,
  ) {}

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

    const { amount, vatAmount, totalAmount } = calculateAmounts(booking);

    const apiKey = this.config.get<string>('MOYASAR_API_KEY', '');
    const backendUrl = this.config.get<string>('BACKEND_URL', 'http://localhost:3000');
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

  async handleMoyasarWebhook(
    signature: string,
    rawBody: Buffer,
    dto: MoyasarWebhookDto,
  ) {
    const secret = this.config.get<string>('MOYASAR_WEBHOOK_SECRET', '');
    if (!secret) {
      this.logger.error('MOYASAR_WEBHOOK_SECRET is not configured');
      throw new UnauthorizedException({
        statusCode: 401,
        message: 'Webhook verification not configured',
        error: 'WEBHOOK_CONFIG_ERROR',
      });
    }

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
      return { success: true };
    }

    if (dto.status === 'paid') {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: 'paid' },
      });

      try {
        await this.invoicesService.createInvoice({ paymentId: payment.id });
      } catch (err) {
        if (!(err instanceof ConflictException)) {
          this.logger.error(`Invoice creation failed for payment ${payment.id}`, err);
        }
      }
    } else if (dto.status === 'failed') {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: 'failed' },
      });
    }

    return { success: true };
  }

  async refund(paymentId: string, amount?: number) {
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
      const refundAmount = amount ?? payment.totalAmount;

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
