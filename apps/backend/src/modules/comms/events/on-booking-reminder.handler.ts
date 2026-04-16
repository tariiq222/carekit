import { Injectable, Logger } from '@nestjs/common';
import { NotificationType, RecipientType } from '@prisma/client';
import { EventBusService, type DomainEventEnvelope } from '../../../infrastructure/events';
import { SendNotificationHandler } from '../send-notification/send-notification.handler';

interface BookingReminderPayload {
  bookingId: string;
  clientId: string;
  scheduledAt: Date | string;
  clientPhone?: string;
  fcmToken?: string;
}

@Injectable()
export class OnBookingReminderHandler {
  private readonly logger = new Logger(OnBookingReminderHandler.name);

  constructor(private readonly notify: SendNotificationHandler) {}

  register(eventBus: EventBusService): void {
    eventBus.subscribe<BookingReminderPayload>('ops.booking.reminder_due', (e) => this.handle(e));
  }

  async handle(envelope: DomainEventEnvelope<BookingReminderPayload>): Promise<void> {
    const { payload } = envelope;
    const scheduledAt = new Date(payload.scheduledAt);
    const timeStr = scheduledAt.toLocaleTimeString('ar-SA', {
      hour: '2-digit',
      minute: '2-digit',
    });
    try {
      await this.notify.execute({
        recipientId: payload.clientId,
        recipientType: RecipientType.CLIENT,
        type: NotificationType.BOOKING_REMINDER,
        title: 'تذكير بموعدك',
        body: `موعدك غداً الساعة ${timeStr}`,
        channels: ['in-app', 'push', 'sms'],
        fcmToken: payload.fcmToken,
        recipientPhone: payload.clientPhone,
      });
    } catch (err) {
      this.logger.error(
        `Failed to handle reminder for booking ${payload.bookingId}`,
        err,
      );
    }
  }
}
