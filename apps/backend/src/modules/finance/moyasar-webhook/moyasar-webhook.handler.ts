import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { PaymentMethod, PaymentStatus } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';
import { EventBusService } from '../../../infrastructure/events';
import { PaymentCompletedEvent } from '../events/payment-completed.event';
import { PaymentFailedEvent } from '../events/payment-failed.event';
import { MoyasarWebhookDto } from './moyasar-webhook.dto';

export interface MoyasarWebhookRequest {
  payload: MoyasarWebhookDto;
  rawBody: string;
  signature: string;
}

/**
 * Processes Moyasar webhook events.
 * Signature verification is mandatory and performed inside execute() before any DB access.
 * Idempotent: if a Payment with the same gatewayRef already exists in COMPLETED status, skips silently.
 */
@Injectable()
export class MoyasarWebhookHandler {
  private readonly logger = new Logger(MoyasarWebhookHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    private readonly config: ConfigService,
  ) {}

  verifySignature(rawBody: string, signature: string, secret: string): void {
    const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
    const expectedBuf = Buffer.from(expected, 'hex');
    const signatureBuf = Buffer.from(signature, 'hex');
    if (
      expectedBuf.length !== signatureBuf.length ||
      !timingSafeEqual(expectedBuf, signatureBuf)
    ) {
      throw new BadRequestException('Invalid Moyasar webhook signature');
    }
  }

  async execute(req: MoyasarWebhookRequest): Promise<{ skipped?: boolean }> {
    // Signature verification is mandatory. If the secret is missing it's a
    // misconfiguration — fail loudly rather than silently accepting the webhook.
    const secret = this.config.get<string>('MOYASAR_SECRET_KEY');
    if (!secret) {
      this.logger.error('MOYASAR_SECRET_KEY not configured — refusing webhook');
      throw new InternalServerErrorException('Payment webhook is not configured');
    }
    this.verifySignature(req.rawBody, req.signature, secret);

    const payload = req.payload;
    const { invoiceId, tenantId } = payload.metadata ?? {};
    if (!invoiceId || !tenantId) {
      this.logger.warn(`Moyasar webhook missing metadata: ${payload.id}`);
      return { skipped: true };
    }

    const existing = await this.prisma.payment.findFirst({
      where: { gatewayRef: payload.id, status: PaymentStatus.COMPLETED },
    });
    if (existing) return { skipped: true };

    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, tenantId },
    });
    if (!invoice) return { skipped: true };

    const amountSar = payload.amount / 100;
    const status: PaymentStatus = payload.status === 'paid' ? PaymentStatus.COMPLETED : PaymentStatus.FAILED;

    const payment = await this.prisma.payment.upsert({
      where: { idempotencyKey: `moyasar:${payload.id}` },
      update: { status, processedAt: new Date(), failureReason: payload.message },
      create: {
        tenantId,
        invoiceId,
        amount: amountSar,
        currency: payload.currency,
        method: PaymentMethod.ONLINE_CARD,
        status,
        gatewayRef: payload.id,
        idempotencyKey: `moyasar:${payload.id}`,
        processedAt: status === PaymentStatus.COMPLETED ? new Date() : undefined,
        failureReason: payload.message,
      },
    });

    if (status === PaymentStatus.COMPLETED) {
      await this.prisma.invoice.update({
        where: { id: invoiceId },
        data: { status: 'PAID', paidAt: new Date() },
      });

      const event = new PaymentCompletedEvent(tenantId, {
        paymentId: payment.id,
        invoiceId: invoice.id,
        bookingId: invoice.bookingId,
        tenantId,
        amount: amountSar,
        currency: invoice.currency,
      });
      await this.eventBus.publish(event.eventName, event.toEnvelope());
    } else if (status === PaymentStatus.FAILED) {
      const failedEvent = new PaymentFailedEvent(tenantId, {
        paymentId: payment.id,
        invoiceId: invoice.id,
        tenantId,
        clientId: invoice.clientId,
        amount: amountSar,
        currency: invoice.currency,
        reason: payload.message,
      });
      await this.eventBus.publish(failedEvent.eventName, failedEvent.toEnvelope());
    }

    return {};
  }
}
