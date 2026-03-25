import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service.js';
import { resilientFetch } from '../../common/helpers/resilient-fetch.helper.js';
import { CreateMoyasarPaymentDto } from './dto/create-moyasar-payment.dto.js';
import {
  paymentInclude,
  bookingWithPriceInclude,
  calculateAmounts,
} from './payments.helpers.js';

@Injectable()
export class MoyasarCheckoutService {
  private readonly logger = new Logger(MoyasarCheckoutService.name);

  constructor(
    private readonly prisma: PrismaService,
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
    if (existingPayment && !['failed'].includes(existingPayment.status)) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'Payment already exists for this booking',
        error: 'DUPLICATE_PAYMENT',
      });
    }
    if (existingPayment?.status === 'failed') {
      await this.prisma.payment.delete({ where: { id: existingPayment.id } });
    }

    const { amount, vatAmount, totalAmount } = calculateAmounts(booking);
    const credentials = this.buildCredentials();
    const backendUrl = this.config.get<string>(
      'BACKEND_URL',
      'http://localhost:3000',
    );

    const moyasarBody = {
      amount: totalAmount,
      currency: 'SAR',
      description: `Booking #${booking.id}`,
      source: dto.source,
      callback_url: `${backendUrl}/api/v1/payments/moyasar/webhook`,
      metadata: { bookingId: booking.id, userId },
    };

    const response = await resilientFetch(
      'https://api.moyasar.com/v1/payments',
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${credentials}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(moyasarBody),
      },
      { circuit: 'moyasar', timeoutMs: 15_000 },
    );

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

    let payment;
    try {
      payment = await this.prisma.payment.create({
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
    } catch (dbErr) {
      // DB failed after Moyasar payment was created — void it to prevent dangling charge
      this.voidMoyasarPayment(moyasarResponse.id).catch((e) =>
        this.logger.error(
          `Failed to void dangling Moyasar payment ${moyasarResponse.id}: ${e.message}`,
        ),
      );
      throw dbErr;
    }

    return {
      payment,
      redirectUrl: moyasarResponse.source?.transaction_url ?? null,
    };
  }

  /**
   * Voids a Moyasar payment that was created but never recorded locally.
   * Best-effort: called fire-and-forget when DB create fails after API succeeds.
   */
  async voidMoyasarPayment(moyasarPaymentId: string): Promise<void> {
    const credentials = this.buildCredentials();
    await resilientFetch(
      `https://api.moyasar.com/v1/payments/${moyasarPaymentId}/void`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${credentials}`,
          'Content-Type': 'application/json',
        },
      },
      { circuit: 'moyasar', timeoutMs: 15_000 },
    );
  }

  buildCredentials(): string {
    const apiKey = this.config.get<string>('MOYASAR_API_KEY', '');
    return Buffer.from(`${apiKey}:`).toString('base64');
  }
}
