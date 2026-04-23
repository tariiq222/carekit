import { adminRequest } from '@/lib/api-client';
import type { PageMeta } from '@/lib/types';
import type { SubscriptionRow, SubscriptionStatus } from '../types';

export interface ListSubscriptionsParams {
  page: number;
  perPage: number;
  status?: SubscriptionStatus;
  planId?: string;
}

export interface ListSubscriptionsResponse {
  items: SubscriptionRow[];
  meta: PageMeta;
}

export function listSubscriptions(p: ListSubscriptionsParams): Promise<ListSubscriptionsResponse> {
  const search = new URLSearchParams({ page: String(p.page), perPage: String(p.perPage) });
  if (p.status) search.set('status', p.status);
  if (p.planId) search.set('planId', p.planId);
  return adminRequest<ListSubscriptionsResponse>(`/billing/subscriptions?${search.toString()}`);
}
