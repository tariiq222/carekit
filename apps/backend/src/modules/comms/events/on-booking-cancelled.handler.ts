import { Injectable, Logger } from '@nestjs/common';
import { NotificationType, RecipientType } from '@prisma/client';
import { EventBusService, type DomainEventEnvelope } from '../../../infrastructure/events';
import { SendNotificationHandler } from '../send-notification/send-notification.handler';

interface BookingCancelledPayload {
  bookingId: string;
  clientId: string;
  employeeId: string;
  reason: string;
  cancelNotes?: string;
  clientEmail?: string;
  clientName?: string;
  clientPhone?: string;
  fcmToken?: string;
}

@Injectable()
export class OnBookingCancelledHandler {
  private readonly logger = new Logger(OnBookingCancelledHandler.name);

  constructor(private readonly notify: SendNotificationHandler) {}

  register(eventBus: EventBusService): void {
    eventBus.subscribe<BookingCancelledPayload>('bookings.booking.cancelled', (e) => this.handle(e));
  }

  async handle(envelope: DomainEventEnvelope<BookingCancelledPayload>): Promise<void> {
    const { payload } = envelope;
    try {
      await this.notify.execute({
        recipientId: payload.clientId,
        recipientType: RecipientType.CLIENT,
        type: NotificationType.BOOKING_CANCELLED,
        title: 'تم إلغاء الحجز',
        body: 'نأسف، تم إلغاء حجزك.',
        channels: ['in-app', 'push', 'email'],
        fcmToken: payload.fcmToken,
        recipientEmail: payload.clientEmail,
        emailTemplateSlug: 'booking-cancelled',
        emailVars: {
          client_name: payload.clientName ?? '',
          booking_id: payload.bookingId,
          reason: payload.reason,
        },
      });
    } catch (err) {
      this.logger.error(
        `Failed to handle bookings.booking.cancelled for booking ${payload.bookingId}`,
        err,
      );
    }
  }
}
