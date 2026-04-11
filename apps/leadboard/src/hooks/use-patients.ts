import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { patientsApi } from '@carekit/api-client'
import type {
  PatientListQuery,
  CreateWalkInPayload,
  UpdatePatientPayload,
} from '@carekit/api-client'
import { QUERY_KEYS } from '@/lib/query-keys'

export function usePatientStats() {
  return useQuery({
    queryKey: QUERY_KEYS.patients.stats,
    queryFn: () => patientsApi.stats(),
  })
}

export function usePatients(query: PatientListQuery = {}) {
  return useQuery({
    queryKey: QUERY_KEYS.patients.list(query as Record<string, unknown>),
    queryFn: () => patientsApi.list(query),
  })
}

export function usePatient(id: string) {
  return useQuery({
    queryKey: QUERY_KEYS.patients.detail(id),
    queryFn: () => patientsApi.get(id),
    enabled: !!id,
  })
}

export function useUpdatePatient(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: UpdatePatientPayload) => patientsApi.update(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.patients.detail(id) })
      qc.invalidateQueries({ queryKey: QUERY_KEYS.patients.all })
    },
  })
}

export function useCreateWalkIn() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateWalkInPayload) => patientsApi.createWalkIn(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.patients.all })
    },
  })
}
