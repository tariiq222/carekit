import { adminRequest } from '@/lib/api-client';
import type { PageMeta } from '@/lib/types';
import type { OrganizationBillingIdentity, SubscriptionInvoiceStatus, BillingCycle } from '../types';

export interface ZohoMirror {
  deqahInvoiceId: string | null;
  zohoInvoiceId: string;
  status: string;
  invoiceUrl: string | null;
  pdfUrl: string | null;
  viewedAt: string | null;
  lastSentAt: string | null;
  createdAt: string;
}

export interface ZohoSaasInvoiceRow {
  id: string;
  subscriptionId: string;
  organizationId: string;
  organization: OrganizationBillingIdentity;
  invoiceNumber: string | null;
  amount: string | number;
  flatAmount: string | number;
  overageAmount: string | number;
  currency: string;
  status: SubscriptionInvoiceStatus;
  billingCycle: BillingCycle;
  periodStart: string;
  periodEnd: string;
  dueDate: string;
  issuedAt: string | null;
  paidAt: string | null;
  createdAt: string;
  nextChargeAt: string;
  subscriptionStatus: string;
  zohoMirror: ZohoMirror | null;
}

export interface ListZohoSaasInvoicesResponse {
  items: ZohoSaasInvoiceRow[];
  meta: PageMeta;
}

export interface ListZohoSaasInvoicesParams {
  page: number;
  perPage: number;
  status?: SubscriptionInvoiceStatus;
  organizationId?: string;
  zohoMirrored?: 'yes' | 'no';
}

export function listZohoSaasInvoices(p: ListZohoSaasInvoicesParams): Promise<ListZohoSaasInvoicesResponse> {
  const search = new URLSearchParams({ page: String(p.page), perPage: String(p.perPage) });
  if (p.status) search.set('status', p.status);
  if (p.organizationId) search.set('organizationId', p.organizationId);
  if (p.zohoMirrored) search.set('zohoMirrored', p.zohoMirrored);
  return adminRequest<ListZohoSaasInvoicesResponse>(`/billing/zoho/invoices?${search.toString()}`);
}
