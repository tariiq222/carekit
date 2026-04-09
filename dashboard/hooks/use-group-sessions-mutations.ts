"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import {
  createGroupSession,
  updateGroupSession,
  deleteGroupSession,
  cancelGroupSession,
  completeGroupSession,
  enrollPatient,
  removeEnrollment,
} from "@/lib/api/group-sessions"
import type { UpdateGroupSessionPayload, MarkAttendancePayload } from "@/lib/types/group-sessions"

export function useGroupSessionsMutations() {
  const queryClient = useQueryClient()

  const invalidateAll = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.groupSessions.all })

  const createSessionMut = useMutation({
    mutationFn: createGroupSession,
    onSuccess: invalidateAll,
  })

  const updateSessionMut = useMutation({
    mutationFn: ({ id, ...payload }: { id: string } & UpdateGroupSessionPayload) =>
      updateGroupSession(id, payload),
    onSuccess: invalidateAll,
  })

  const deleteSessionMut = useMutation({
    mutationFn: deleteGroupSession,
    onSuccess: invalidateAll,
  })

  const cancelSessionMut = useMutation({
    mutationFn: cancelGroupSession,
    onSuccess: invalidateAll,
  })

  const completeSessionMut = useMutation({
    mutationFn: ({ id, ...payload }: { id: string } & MarkAttendancePayload) =>
      completeGroupSession(id, payload),
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
    createSessionMut,
    updateSessionMut,
    deleteSessionMut,
    cancelSessionMut,
    completeSessionMut,
    enrollPatientMut,
    removeEnrollmentMut,
  }
}
