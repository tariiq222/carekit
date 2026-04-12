import { BaseEvent } from '../../../common/events';

export interface BookingCancelRejectedPayload {
  bookingId: string;
  tenantId: string;
  clientId: string;
  employeeId: string;
  rejectReason: string;
}

export class BookingCancelRejectedEvent extends BaseEvent<BookingCancelRejectedPayload> {
  readonly eventName = 'bookings.booking.cancel_rejected';

  constructor(tenantId: string, payload: BookingCancelRejectedPayload) {
    super({ source: 'bookings', version: 1, tenantId, payload });
  }
}
