import { BaseEvent } from '../../../../common/events';

export interface SubscriptionInvoicePaidPayload {
  /** Platform `SubscriptionInvoice.id`. */
  subscriptionInvoiceId: string;
  /** The tenant Deqah `Organization.id` being billed. */
  organizationId: string;
  /** Subscription this invoice was issued for. */
  subscriptionId: string;
  amount: number;
  currency: string;
  /** Moyasar charge id used to settle the invoice. */
  moyasarPaymentId: string;
  paidAt: Date;
}

/**
 * Emitted from {@link RecordSubscriptionPaymentHandler} after a successful
 * Moyasar charge marks a SubscriptionInvoice paid. The Zoho SaaS-billing
 * module subscribes to mirror the invoice into Deqah's platform Zoho org.
 */
export class SubscriptionInvoicePaidEvent extends BaseEvent<SubscriptionInvoicePaidPayload> {
  readonly eventName = 'platform.subscription_invoice.paid';

  constructor(payload: SubscriptionInvoicePaidPayload) {
    super({ source: 'platform.billing', version: 1, payload });
  }
}
