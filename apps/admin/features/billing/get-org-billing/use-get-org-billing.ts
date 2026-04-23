import { useQuery } from '@tanstack/react-query';
import { getOrgBilling } from './get-org-billing.api';

export const orgBillingKey = (orgId: string) => ['billing', 'org', orgId] as const;

export function useGetOrgBilling(orgId: string) {
  return useQuery({
    queryKey: orgBillingKey(orgId),
    queryFn: () => getOrgBilling(orgId),
    enabled: Boolean(orgId),
  });
}
