import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { specialtiesApi } from '@carekit/api-client'
import type {
  CreateSpecialtyPayload,
  UpdateSpecialtyPayload,
} from '@carekit/api-client'
import { QUERY_KEYS } from '@/lib/query-keys'

export function useSpecialties() {
  return useQuery({
    queryKey: QUERY_KEYS.specialties.list,
    queryFn: () => specialtiesApi.list(),
  })
}

export function useSpecialty(id: string) {
  return useQuery({
    queryKey: QUERY_KEYS.specialties.detail(id),
    queryFn: () => specialtiesApi.get(id),
    enabled: !!id,
  })
}

export function useCreateSpecialty() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateSpecialtyPayload) => specialtiesApi.create(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.specialties.all })
    },
  })
}

export function useUpdateSpecialty(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: UpdateSpecialtyPayload) =>
      specialtiesApi.update(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.specialties.detail(id) })
      qc.invalidateQueries({ queryKey: QUERY_KEYS.specialties.all })
    },
  })
}

export function useDeleteSpecialty() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => specialtiesApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.specialties.all })
    },
  })
}
