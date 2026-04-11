import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { practitionersApi } from '@carekit/api-client'
import type {
  PractitionerListQuery,
  CreatePractitionerPayload,
  UpdatePractitionerPayload,
} from '@carekit/api-client'
import { QUERY_KEYS } from '@/lib/query-keys'

export function usePractitionerStats() {
  return useQuery({
    queryKey: QUERY_KEYS.practitioners.stats,
    queryFn: () => practitionersApi.stats(),
  })
}

export function usePractitioners(query: PractitionerListQuery = {}) {
  return useQuery({
    queryKey: QUERY_KEYS.practitioners.list(query as Record<string, unknown>),
    queryFn: () => practitionersApi.list(query),
  })
}

export function usePractitioner(id: string) {
  return useQuery({
    queryKey: QUERY_KEYS.practitioners.detail(id),
    queryFn: () => practitionersApi.get(id),
    enabled: !!id,
  })
}

export function useCreatePractitioner() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreatePractitionerPayload) => practitionersApi.create(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.practitioners.all })
    },
  })
}

export function useUpdatePractitioner(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: UpdatePractitionerPayload) =>
      practitionersApi.update(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.practitioners.detail(id) })
      qc.invalidateQueries({ queryKey: QUERY_KEYS.practitioners.all })
    },
  })
}

export function useDeletePractitioner() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => practitionersApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.practitioners.all })
    },
  })
}
