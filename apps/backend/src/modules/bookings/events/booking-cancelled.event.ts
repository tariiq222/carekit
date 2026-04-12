import { BaseEvent } from '../../../common/events';
import { CancellationReason } from '@prisma/client';

export interface BookingCancelledPayload {
  bookingId: string;
  tenantId: string;
  clientId: string;
  employeeId: string;
  reason: CancellationReason;
  cancelNotes?: string;
  zoomMeetingId?: string | null;
}

/**
 * Emitted when a booking is cancelled.
 * finance/ subscribes to trigger refund if payment exists.
 * comms/ subscribes to send cancellation notification.
 */
export class BookingCancelledEvent extends BaseEvent<BookingCancelledPayload> {
  readonly eventName = 'bookings.booking.cancelled';

  constructor(tenantId: string, payload: BookingCancelledPayload) {
    super({ source: 'bookings', version: 1, tenantId, payload });
  }
}
