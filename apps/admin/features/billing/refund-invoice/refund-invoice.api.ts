import { adminRequest } from '@/lib/api-client';
import type { SubscriptionInvoiceRow } from '../types';

export interface RefundInvoiceCommand {
  invoiceId: string;
  /** Amount in SAR. Omit for full refund of remaining. */
  amount?: number;
  reason: string;
}

export function refundInvoice({
  invoiceId,
  amount,
  reason,
}: RefundInvoiceCommand): Promise<SubscriptionInvoiceRow> {
  return adminRequest<SubscriptionInvoiceRow>(`/billing/invoices/${invoiceId}/refund`, {
    method: 'POST',
    body: JSON.stringify(amount === undefined ? { reason } : { amount, reason }),
  });
}
