import { useQuery } from '@tanstack/react-query';
import { getOrganization } from './get-organization.api';

export const organizationDetailKey = (id: string) => ['organizations', 'detail', id] as const;

export function useGetOrganization(id: string) {
  return useQuery({
    queryKey: organizationDetailKey(id),
    queryFn: () => getOrganization(id),
  });
}
