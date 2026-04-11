import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { practitionersApi } from '@carekit/api-client'
import type {
  PractitionerListQuery,
  CreatePractitionerPayload,
  UpdatePractitionerPayload,
  SetBreaksPayload,
  CreateVacationPayload,
  AssignPractitionerServicePayload,
  UpdatePractitionerServicePayload,
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

// ─── Breaks ────────────────────────────────────────────────────────────────

export function usePractitionerBreaks(practitionerId: string) {
  return useQuery({
    queryKey: QUERY_KEYS.practitioners.breaks(practitionerId),
    queryFn: () => practitionersApi.getBreaks(practitionerId),
    enabled: !!practitionerId,
  })
}

export function useSetPractitionerBreaks(practitionerId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: SetBreaksPayload) =>
      practitionersApi.setBreaks(practitionerId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.practitioners.breaks(practitionerId) })
    },
  })
}

// ─── Vacations ─────────────────────────────────────────────────────────────

export function usePractitionerVacations(practitionerId: string) {
  return useQuery({
    queryKey: QUERY_KEYS.practitioners.vacations(practitionerId),
    queryFn: () => practitionersApi.getVacations(practitionerId),
    enabled: !!practitionerId,
  })
}

export function useCreatePractitionerVacation(practitionerId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateVacationPayload) =>
      practitionersApi.createVacation(practitionerId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.practitioners.vacations(practitionerId) })
    },
  })
}

export function useDeletePractitionerVacation(practitionerId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vacationId: string) =>
      practitionersApi.deleteVacation(practitionerId, vacationId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.practitioners.vacations(practitionerId) })
    },
  })
}

// ─── Practitioner Services ─────────────────────────────────────────────────

export function usePractitionerServices(practitionerId: string) {
  return useQuery({
    queryKey: QUERY_KEYS.practitioners.practitionerServices(practitionerId),
    queryFn: () => practitionersApi.listServices(practitionerId),
    enabled: !!practitionerId,
  })
}

export function useAssignPractitionerService(practitionerId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: AssignPractitionerServicePayload) =>
      practitionersApi.assignService(practitionerId, payload),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: QUERY_KEYS.practitioners.practitionerServices(practitionerId),
      })
    },
  })
}

export function useUpdatePractitionerService(practitionerId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ serviceId, payload }: { serviceId: string; payload: UpdatePractitionerServicePayload }) =>
      practitionersApi.updateService(practitionerId, serviceId, payload),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: QUERY_KEYS.practitioners.practitionerServices(practitionerId),
      })
    },
  })
}

export function useRemovePractitionerService(practitionerId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (serviceId: string) =>
      practitionersApi.removeService(practitionerId, serviceId),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: QUERY_KEYS.practitioners.practitionerServices(practitionerId),
      })
    },
  })
}
