import { adminRequest } from '@/lib/api-client';
import type { SubscriptionInvoiceRow } from '../types';

export interface WaiveInvoiceCommand {
  invoiceId: string;
  reason: string;
}

export function waiveInvoice({ invoiceId, reason }: WaiveInvoiceCommand): Promise<SubscriptionInvoiceRow> {
  return adminRequest<SubscriptionInvoiceRow>(`/billing/invoices/${invoiceId}/waive`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}
