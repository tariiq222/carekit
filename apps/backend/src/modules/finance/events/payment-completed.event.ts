import { BaseEvent } from '../../../common/events';

export interface PaymentCompletedPayload {
  paymentId: string;
  invoiceId: string;
  bookingId: string;
  amount: number;
  currency: string;
}

/**
 * Emitted when a payment reaches COMPLETED status.
 * bookings/ subscribes to update booking status to CONFIRMED.
 * comms/ subscribes to send receipt notification.
 */
export class PaymentCompletedEvent extends BaseEvent<PaymentCompletedPayload> {
  readonly eventName = 'finance.payment.completed';

  constructor(payload: PaymentCompletedPayload) {
    super({ source: 'finance', version: 1, payload });
  }
}
