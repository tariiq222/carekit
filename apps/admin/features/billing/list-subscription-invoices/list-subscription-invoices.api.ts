import { adminRequest } from '@/lib/api-client';
import type { PageMeta } from '@/lib/types';
import type { SubscriptionInvoiceRow, SubscriptionInvoiceStatus } from '../types';

export interface ListSubscriptionInvoicesParams {
  page: number;
  perPage: number;
  status?: SubscriptionInvoiceStatus;
  organizationId?: string;
  fromDate?: string;
  toDate?: string;
  includeDrafts?: boolean;
}

export interface ListSubscriptionInvoicesResponse {
  items: SubscriptionInvoiceRow[];
  meta: PageMeta;
}

export function listSubscriptionInvoices(
  p: ListSubscriptionInvoicesParams,
): Promise<ListSubscriptionInvoicesResponse> {
  const search = new URLSearchParams({ page: String(p.page), perPage: String(p.perPage) });
  if (p.status) search.set('status', p.status);
  if (p.organizationId) search.set('organizationId', p.organizationId);
  if (p.fromDate) search.set('fromDate', p.fromDate);
  if (p.toDate) search.set('toDate', p.toDate);
  if (p.includeDrafts) search.set('includeDrafts', 'true');
  return adminRequest<ListSubscriptionInvoicesResponse>(
    `/billing/invoices?${search.toString()}`,
  );
}
