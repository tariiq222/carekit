import { useQuery } from '@tanstack/react-query';
import { getOrgBilling } from './get-org-billing.api';

export function orgBillingKey(orgId: string) {
  return ['org-billing', orgId] as const;
}

export function useGetOrgBilling(orgId: string) {
  return useQuery({
    queryKey: orgBillingKey(orgId),
    queryFn: () => getOrgBilling(orgId),
    staleTime: 30_000,
  });
}
