import { Injectable, Logger } from '@nestjs/common';
import { NotificationType, RecipientType } from '@prisma/client';
import { EventBusService, type DomainEventEnvelope } from '../../../infrastructure/events';
import { SendNotificationHandler } from '../send-notification/send-notification.handler';

interface PaymentFailedPayload {
  paymentId: string;
  clientId: string;
  amount: number;
  currency: string;
  clientEmail?: string;
  clientName?: string;
  fcmToken?: string;
}

@Injectable()
export class OnPaymentFailedHandler {
  private readonly logger = new Logger(OnPaymentFailedHandler.name);

  constructor(private readonly notify: SendNotificationHandler) {}

  register(eventBus: EventBusService): void {
    eventBus.subscribe<PaymentFailedPayload>('finance.payment.failed', (e) => this.handle(e));
  }

  async handle(envelope: DomainEventEnvelope<PaymentFailedPayload>): Promise<void> {
    const { payload } = envelope;
    try {
      await this.notify.execute({
        recipientId: payload.clientId,
        recipientType: RecipientType.CLIENT,
        type: NotificationType.PAYMENT_FAILED,
        title: 'فشل الدفع',
        body: `لم تتم معالجة دفعتك بقيمة ${payload.amount} ${payload.currency}. يرجى المحاولة مرة أخرى.`,
        channels: ['in-app', 'push', 'email'],
        fcmToken: payload.fcmToken,
        recipientEmail: payload.clientEmail,
        emailTemplateSlug: 'payment-failed',
        emailVars: {
          client_name: payload.clientName ?? '',
          amount: String(payload.amount),
          currency: payload.currency,
        },
      });
    } catch (err) {
      this.logger.error(
        `Failed to handle payment failed for payment ${payload.paymentId}`,
        err,
      );
    }
  }
}
