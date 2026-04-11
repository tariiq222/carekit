import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { intakeFormsApi } from '@carekit/api-client'
import type {
  IntakeFormListQuery,
  CreateIntakeFormPayload,
  UpdateIntakeFormPayload,
} from '@carekit/api-client'
import { QUERY_KEYS } from '@/lib/query-keys'

export function useIntakeForms(query: IntakeFormListQuery = {}) {
  return useQuery({
    queryKey: QUERY_KEYS.intakeForms.list(query as Record<string, unknown>),
    queryFn: () => intakeFormsApi.list(query),
  })
}

export function useIntakeForm(id: string) {
  return useQuery({
    queryKey: QUERY_KEYS.intakeForms.detail(id),
    queryFn: () => intakeFormsApi.get(id),
    enabled: !!id,
  })
}

export function useCreateIntakeForm() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (p: CreateIntakeFormPayload) => intakeFormsApi.create(p),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEYS.intakeForms.all }),
  })
}

export function useUpdateIntakeForm(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (p: UpdateIntakeFormPayload) => intakeFormsApi.update(id, p),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.intakeForms.detail(id) })
      qc.invalidateQueries({ queryKey: QUERY_KEYS.intakeForms.all })
    },
  })
}

export function useDeleteIntakeForm() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => intakeFormsApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEYS.intakeForms.all }),
  })
}
