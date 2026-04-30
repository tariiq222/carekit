import { adminRequest } from '@/lib/api-client';
import type { SubscriptionRow } from '../types';

export function cancelScheduledCancellation(orgId: string): Promise<SubscriptionRow> {
  return adminRequest<SubscriptionRow>(`/billing/subscriptions/${orgId}/cancel-scheduled`, {
    method: 'POST',
  });
}
