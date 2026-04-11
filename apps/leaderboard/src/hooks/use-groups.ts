import { useQuery } from '@tanstack/react-query'
import { groupsApi } from '@carekit/api-client'
import type { GroupListQuery } from '@carekit/api-client'
import { QUERY_KEYS } from '@/lib/query-keys'

export function useGroups(query: GroupListQuery = {}) {
  return useQuery({
    queryKey: QUERY_KEYS.groups.list(query as Record<string, unknown>),
    queryFn: () => groupsApi.list(query),
  })
}

export function useGroup(id: string) {
  return useQuery({
    queryKey: QUERY_KEYS.groups.detail(id),
    queryFn: () => groupsApi.get(id),
    enabled: !!id,
  })
}
