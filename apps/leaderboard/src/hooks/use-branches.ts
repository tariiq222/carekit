import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { branchesApi } from '@carekit/api-client'
import type {
  BranchListQuery,
  CreateBranchPayload,
  UpdateBranchPayload,
} from '@carekit/api-client'
import { QUERY_KEYS } from '@/lib/query-keys'

export function useBranches(query: BranchListQuery = {}) {
  return useQuery({
    queryKey: QUERY_KEYS.branches.list(query as Record<string, unknown>),
    queryFn: () => branchesApi.list(query),
  })
}

export function useBranch(id: string) {
  return useQuery({
    queryKey: QUERY_KEYS.branches.detail(id),
    queryFn: () => branchesApi.get(id),
    enabled: !!id,
  })
}

export function useCreateBranch() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateBranchPayload) => branchesApi.create(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.branches.all })
    },
  })
}

export function useUpdateBranch(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: UpdateBranchPayload) => branchesApi.update(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.branches.detail(id) })
      qc.invalidateQueries({ queryKey: QUERY_KEYS.branches.all })
    },
  })
}

export function useDeleteBranch() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => branchesApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.branches.all })
    },
  })
}
