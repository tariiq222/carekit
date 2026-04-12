import { BaseEvent } from '../../../common/events';

export interface BookingCancelApprovedPayload {
  bookingId: string;
  tenantId: string;
  clientId: string;
  employeeId: string;
  autoRefund: boolean;
  approverNotes?: string;
}

export class BookingCancelApprovedEvent extends BaseEvent<BookingCancelApprovedPayload> {
  readonly eventName = 'bookings.booking.cancel_approved';

  constructor(tenantId: string, payload: BookingCancelApprovedPayload) {
    super({ source: 'bookings', version: 1, tenantId, payload });
  }
}
