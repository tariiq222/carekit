import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { servicesApi } from '@carekit/api-client'
import type {
  ServiceListQuery,
  CreateServicePayload,
  UpdateServicePayload,
} from '@carekit/api-client'
import { QUERY_KEYS } from '@/lib/query-keys'

export function useServiceCategories() {
  return useQuery({
    queryKey: QUERY_KEYS.services.categories,
    queryFn: () => servicesApi.listCategories(),
    staleTime: 5 * 60 * 1000,
  })
}

export function useServiceStats() {
  return useQuery({
    queryKey: QUERY_KEYS.services.stats,
    queryFn: () => servicesApi.stats(),
  })
}

export function useServices(query: ServiceListQuery = {}) {
  return useQuery({
    queryKey: QUERY_KEYS.services.list(query as Record<string, unknown>),
    queryFn: () => servicesApi.list(query),
  })
}

export function useService(id: string) {
  return useQuery({
    queryKey: QUERY_KEYS.services.detail(id),
    queryFn: () => servicesApi.get(id),
    enabled: !!id,
  })
}

export function useCreateService() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateServicePayload) => servicesApi.create(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.services.all })
    },
  })
}

export function useUpdateService(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: UpdateServicePayload) => servicesApi.update(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.services.detail(id) })
      qc.invalidateQueries({ queryKey: QUERY_KEYS.services.all })
    },
  })
}

export function useDeleteService() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => servicesApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.services.all })
    },
  })
}
