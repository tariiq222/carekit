import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { ClsService } from 'nestjs-cls';
import { PaymentMethod, PaymentStatus } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';
import { EventBusService } from '../../../infrastructure/events';
import { SYSTEM_CONTEXT_CLS_KEY } from '../../../common/tenant/tenant.constants';
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
 *
 * Three-stage flow (SaaS-02e):
 *   1. Verify HMAC signature (pure crypto, no DB).
 *   2. Resolve tenant from payload — reads Payment/Invoice under a
 *      system-context flag that bypasses Proxy organizationId filtering.
 *      Inbound webhooks carry no CLS tenant; the invoice metadata tells us
 *      which org the payment belongs to.
 *   3. Run mutations inside `cls.run` with the resolved organizationId so
 *      the Proxy auto-scopes and RLS is satisfied.
 *
 * Idempotency: a Payment with the same gatewayRef in COMPLETED status is
 * skipped. The idempotency lookup also runs in system context because the
 * same gatewayRef could theoretically belong to any org.
 */
@Injectable()
export class MoyasarWebhookHandler {
  private readonly logger = new Logger(MoyasarWebhookHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    private readonly config: ConfigService,
    private readonly cls: ClsService,
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
    // STAGE 1 — verify signature. Mandatory; fail loudly on misconfiguration.
    const secret = this.config.get<string>('MOYASAR_SECRET_KEY');
    if (!secret) {
      this.logger.error('MOYASAR_SECRET_KEY not configured — refusing webhook');
      throw new InternalServerErrorException('Payment webhook is not configured');
    }
    this.verifySignature(req.rawBody, req.signature, secret);

    const payload = req.payload;
    const { invoiceId } = payload.metadata ?? {};
    if (!invoiceId) {
      this.logger.warn(`Moyasar webhook missing metadata: ${payload.id}`);
      return { skipped: true };
    }

    // STAGE 2 — resolve tenant from payload under system context (bypasses
    // Proxy org filter). The webhook arrives unauthenticated; the signed
    // payload itself is our authorization to look up the invoice.
    const invoice = await this.cls.run(async () => {
      this.logger.warn('systemContext bypass activated', { context: 'MoyasarWebhookHandler' });
      this.cls.set(SYSTEM_CONTEXT_CLS_KEY, true);
      return this.prisma.invoice.findFirst({ where: { id: invoiceId } });
    });
    if (!invoice) return { skipped: true };

    // Idempotency check — also in system context. A given gatewayRef could
    // theoretically belong to any org; we rely on the signed payload as
    // authorization to observe it regardless of CLS.
    const existing = await this.cls.run(async () => {
      this.logger.warn('systemContext bypass activated', { context: 'MoyasarWebhookHandler' });
      this.cls.set(SYSTEM_CONTEXT_CLS_KEY, true);
      return this.prisma.payment.findFirst({
        where: { gatewayRef: payload.id, status: PaymentStatus.COMPLETED },
      });
    });
    if (existing) return { skipped: true };

    // STAGE 3 — run mutations inside the resolved tenant's CLS context.
    return this.cls.run(async () => {
      this.cls.set('tenant', {
        organizationId: invoice.organizationId,
        membershipId: 'system',
        id: 'system',
        role: 'system',
        isSuperAdmin: false,
      });

      const amountSar = payload.amount / 100;
      const status: PaymentStatus =
        payload.status === 'paid' ? PaymentStatus.COMPLETED : PaymentStatus.FAILED;

      const payment = await this.prisma.payment.upsert({
        where: { idempotencyKey: `moyasar:${payload.id}` },
        update: { status, processedAt: new Date(), failureReason: payload.message },
        create: {
          organizationId: invoice.organizationId, // SaaS-02e
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

        const event = new PaymentCompletedEvent({
          paymentId: payment.id,
          invoiceId: invoice.id,
          bookingId: invoice.bookingId,
          amount: amountSar,
          currency: invoice.currency,
          organizationId: invoice.organizationId,
        });
        await this.eventBus.publish(event.eventName, event.toEnvelope());
      } else if (status === PaymentStatus.FAILED) {
        const failedEvent = new PaymentFailedEvent({
          paymentId: payment.id,
          invoiceId: invoice.id,
          clientId: invoice.clientId,
          amount: amountSar,
          currency: invoice.currency,
          reason: payload.message,
          organizationId: invoice.organizationId,
        });
        await this.eventBus.publish(failedEvent.eventName, failedEvent.toEnvelope());
      }

      return {};
    });
  }
}
