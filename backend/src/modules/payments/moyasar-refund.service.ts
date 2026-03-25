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

    if (payment.method === 'moyasar' && payment.moyasarPaymentId) {
      await this.callMoyasarRefund(
        payment.moyasarPaymentId,
        amount ?? payment.totalAmount,
      );
    }

    return this.prisma.payment.update({
      where: { id: paymentId },
      data: { status: 'refunded' },
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
