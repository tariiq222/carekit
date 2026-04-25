import { adminRequest } from '@/lib/api-client';

export interface OrgBillingSubscription {
  id: string;
  status: string;
  billingCycle: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  planId: string;
  plan: {
    slug: string;
    nameEn: string;
    priceMonthly: string | number;
  };
}

export interface OrgBillingResponse {
  org: {
    id: string;
    slug: string;
    nameAr: string;
    nameEn: string | null;
    status: string;
  };
  subscription: OrgBillingSubscription | null;
}

export function getOrgBilling(orgId: string): Promise<OrgBillingResponse> {
  return adminRequest<OrgBillingResponse>(`/billing/subscriptions/${orgId}`);
}
