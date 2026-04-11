"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import {
  createPractitioner,
  onboardPractitioner,
  updatePractitioner,
  deletePractitioner,
  setAvailability,
  setBreaks,
  createVacation,
  deleteVacation,
  assignService,
  updatePractitionerService,
  removePractitionerService,
} from "@/lib/api/practitioners"
import type {
  AssignServicePayload,
  UpdateServicePayload,
  OnboardPractitionerPayload,
} from "@/lib/types/practitioner"

/* ─── Core CRUD Mutations ─── */

export function usePractitionerMutations() {
  const queryClient = useQueryClient()
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.practitioners.all })

  const createMutation = useMutation({
    mutationFn: createPractitioner,
    onSuccess: invalidate,
  })

  const onboardMutation = useMutation({
    mutationFn: (payload: OnboardPractitionerPayload) => onboardPractitioner(payload),
    onSuccess: invalidate,
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, ...payload }: { id: string } & Parameters<typeof updatePractitioner>[1]) =>
      updatePractitioner(id, payload),
    onSuccess: invalidate,
  })

  const deleteMutation = useMutation({
    mutationFn: deletePractitioner,
    onSuccess: invalidate,
  })

  return { createMutation, onboardMutation, updateMutation, deleteMutation }
}

/* ─── Availability Mutation ─── */

export function useSetAvailability() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...payload }: { id: string } & Parameters<typeof setAvailability>[1]) =>
      setAvailability(id, payload),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.practitioners.availability(vars.id),
      })
    },
  })
}

/* ─── Breaks Mutation ─── */

export function useSetBreaks() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...payload }: { id: string } & Parameters<typeof setBreaks>[1]) =>
      setBreaks(id, payload),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.practitioners.breaks(vars.id),
      })
    },
  })
}

/* ─── Vacation Mutations ─── */

export function useVacationMutations(practitionerId: string) {
  const queryClient = useQueryClient()
  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: queryKeys.practitioners.vacations(practitionerId),
    })

  const createMut = useMutation({
    mutationFn: (payload: Parameters<typeof createVacation>[1]) =>
      createVacation(practitionerId, payload),
    onSuccess: invalidate,
  })

  const deleteMut = useMutation({
    mutationFn: (vacationId: string) =>
      deleteVacation(practitionerId, vacationId),
    onSuccess: invalidate,
  })

  return { createMut, deleteMut }
}

/* ─── Practitioner Service Mutations ─── */

export function usePractitionerServiceMutations(practitionerId: string) {
  const queryClient = useQueryClient()
  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: queryKeys.practitioners.services(practitionerId),
    })

  const assignMut = useMutation({
    mutationFn: (payload: AssignServicePayload) =>
      assignService(practitionerId, payload),
    onSuccess: invalidate,
  })

  const updateMut = useMutation({
    mutationFn: ({
      serviceId,
      payload,
    }: {
      serviceId: string
      payload: UpdateServicePayload
    }) => updatePractitionerService(practitionerId, serviceId, payload),
    onSuccess: invalidate,
  })

  const removeMut = useMutation({
    mutationFn: (serviceId: string) =>
      removePractitionerService(practitionerId, serviceId),
    onSuccess: invalidate,
  })

  return { assignMut, updateMut, removeMut }
}
