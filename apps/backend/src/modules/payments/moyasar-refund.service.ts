import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service.js';
import { resilientFetch } from '../../common/helpers/resilient-fetch.helper.js';
import { paymentInclude } from './payments.helpers.js';
import { MoyasarCheckoutService } from './moyasar-checkout.service.js';

@Injectable()
export class MoyasarRefundService {
  private readonly logger = new Logger(MoyasarRefundService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly checkoutService: MoyasarCheckoutService,
  ) {}

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

    const booking = payment.bookingId
      ? await this.prisma.booking.findUnique({
          where: { id: payment.bookingId },
          select: { status: true },
        })
      : null;
    if (booking && !['cancelled', 'no_show'].includes(booking.status)) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'Refunds can only be issued for cancelled or no-show bookings',
        error: 'BOOKING_NOT_CANCELLED',
      });
    }

    const refundAmount = amount ?? payment.totalAmount;

    // Atomically claim the payment for refund before calling any external API.
    // updateMany with status: 'paid' condition acts as a compare-and-swap —
    // if another concurrent call already claimed it, count = 0 and we bail out.
    const claimed = await this.prisma.payment.updateMany({
      where: { id: paymentId, status: 'paid' },
      data: {
        status: 'refunded',
        refundAmount,
        refundedAt: new Date(),
        refundedBy: 'system',
      },
    });
    if (claimed.count === 0) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'Payment was already refunded by a concurrent request',
        error: 'ALREADY_REFUNDED',
      });
    }

    if (payment.method === 'moyasar' && payment.moyasarPaymentId) {
      try {
        await this.callMoyasarRefund(payment.moyasarPaymentId, refundAmount);
      } catch (err) {
        // Moyasar call failed — revert the DB status so the refund can be retried.
        await this.prisma.payment.updateMany({
          where: { id: paymentId, status: 'refunded' },
          data: {
            status: 'paid',
            refundAmount: null,
            refundedAt: null,
            refundedBy: null,
          },
        });
        throw err;
      }
    }

    return this.prisma.payment.findUniqueOrThrow({
      where: { id: paymentId },
      include: paymentInclude,
    });
  }

  private async callMoyasarRefund(
    moyasarPaymentId: string,
    refundAmount: number,
  ): Promise<void> {
    const credentials = this.checkoutService.buildCredentials();

    const response = await resilientFetch(
      `https://api.moyasar.com/v1/payments/${moyasarPaymentId}/refund`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${credentials}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ amount: refundAmount }),
      },
      { circuit: 'moyasar', timeoutMs: 15_000 },
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
}
