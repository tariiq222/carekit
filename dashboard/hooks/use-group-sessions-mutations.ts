"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import {
  createOffering,
  updateOffering,
  deleteOffering,
  createSession,
  cancelSession,
  completeSession,
  enrollPatient,
  removeEnrollment,
} from "@/lib/api/group-sessions"
import type { UpdateOfferingPayload, CreateSessionPayload, MarkAttendancePayload } from "@/lib/types/group-sessions"

export function useGroupSessionsMutations() {
  const queryClient = useQueryClient()

  const invalidateAll = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.groupSessions.all })

  const createOfferingMut = useMutation({
    mutationFn: createOffering,
    onSuccess: invalidateAll,
  })

  const updateOfferingMut = useMutation({
    mutationFn: ({ id, ...payload }: { id: string } & UpdateOfferingPayload) =>
      updateOffering(id, payload),
    onSuccess: invalidateAll,
  })

  const deleteOfferingMut = useMutation({
    mutationFn: deleteOffering,
    onSuccess: invalidateAll,
  })

  const createSessionMut = useMutation({
    mutationFn: ({ offeringId, ...payload }: { offeringId: string } & CreateSessionPayload) =>
      createSession(offeringId, payload),
    onSuccess: invalidateAll,
  })

  const cancelSessionMut = useMutation({
    mutationFn: cancelSession,
    onSuccess: invalidateAll,
  })

  const completeSessionMut = useMutation({
    mutationFn: ({ id, ...payload }: { id: string } & MarkAttendancePayload) =>
      completeSession(id, payload),
    onSuccess: invalidateAll,
  })

  const enrollPatientMut = useMutation({
    mutationFn: ({ sessionId, patientId }: { sessionId: string; patientId: string }) =>
      enrollPatient(sessionId, patientId),
    onSuccess: invalidateAll,
  })

  const removeEnrollmentMut = useMutation({
    mutationFn: ({ sessionId, enrollmentId }: { sessionId: string; enrollmentId: string }) =>
      removeEnrollment(sessionId, enrollmentId),
    onSuccess: invalidateAll,
  })

  return {
    createOfferingMut,
    updateOfferingMut,
    deleteOfferingMut,
    createSessionMut,
    cancelSessionMut,
    completeSessionMut,
    enrollPatientMut,
    removeEnrollmentMut,
  }
}
