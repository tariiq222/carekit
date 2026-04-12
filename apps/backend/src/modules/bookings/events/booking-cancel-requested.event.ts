import { BaseEvent } from '../../../common/events';
import { CancellationReason } from '@prisma/client';

export interface BookingCancelRequestedPayload {
  bookingId: string;
  tenantId: string;
  clientId: string;
  employeeId: string;
  reason: CancellationReason;
  cancelNotes?: string;
}

export class BookingCancelRequestedEvent extends BaseEvent<BookingCancelRequestedPayload> {
  readonly eventName = 'bookings.booking.cancel_requested';

  constructor(tenantId: string, payload: BookingCancelRequestedPayload) {
    super({ source: 'bookings', version: 1, tenantId, payload });
  }
}
