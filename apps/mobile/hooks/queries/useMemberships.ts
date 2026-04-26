import { useMutation, useQuery } from '@tanstack/react-query';

import {
  membershipsService,
  type MembershipSummary,
  type SwitchOrgTokens,
} from '@/services/memberships';

export const membershipsKeys = {
  all: ['memberships'] as const,
};

export function useMemberships() {
  return useQuery<MembershipSummary[]>({
    queryKey: membershipsKeys.all,
    queryFn: () => membershipsService.list(),
    staleTime: 60_000,
  });
}

export function useSwitchOrganization() {
  return useMutation<SwitchOrgTokens, Error, string>({
    mutationFn: (organizationId) =>
      membershipsService.switchOrganization(organizationId),
  });
}
