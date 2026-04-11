import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { departmentsApi } from '@carekit/api-client'
import type {
  DepartmentListQuery,
  CreateDepartmentPayload,
  UpdateDepartmentPayload,
} from '@carekit/api-client'
import { QUERY_KEYS } from '@/lib/query-keys'

export function useDepartments(query: DepartmentListQuery = {}) {
  return useQuery({
    queryKey: QUERY_KEYS.departments.list(query as Record<string, unknown>),
    queryFn: () => departmentsApi.list(query),
  })
}

export function useDepartment(id: string) {
  return useQuery({
    queryKey: QUERY_KEYS.departments.detail(id),
    queryFn: () => departmentsApi.get(id),
    enabled: !!id,
  })
}

export function useCreateDepartment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateDepartmentPayload) => departmentsApi.create(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.departments.all })
    },
  })
}

export function useUpdateDepartment(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: UpdateDepartmentPayload) =>
      departmentsApi.update(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.departments.detail(id) })
      qc.invalidateQueries({ queryKey: QUERY_KEYS.departments.all })
    },
  })
}

export function useDeleteDepartment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => departmentsApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.departments.all })
    },
  })
}
