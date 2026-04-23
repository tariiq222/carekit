import { adminRequest } from '@/lib/api-client';
import type { OrgBillingDetail } from '../types';

export function getOrgBilling(orgId: string): Promise<OrgBillingDetail> {
  return adminRequest<OrgBillingDetail>(`/billing/subscriptions/${orgId}`);
}
