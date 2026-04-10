"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import {
  createGroup,
  updateGroup,
  deleteGroup,
  cancelGroup,
  completeGroup,
  triggerGroupPayment,
  confirmGroupSchedule,
  enrollPatientInGroup,
  removeGroupEnrollment,
  bulkConfirmGroupAttendance,
  issueGroupCertificate,
} from "@/lib/api/groups"
import type { UpdateGroupPayload, BulkAttendancePayload, ConfirmSchedulePayload } from "@/lib/types/groups"

export function useGroupsMutations() {
  const queryClient = useQueryClient()

  const invalidateAll = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.groups.all })

  const createGroupMut = useMutation({
    mutationFn: createGroup,
    onSuccess: invalidateAll,
  })

  const updateGroupMut = useMutation({
    mutationFn: ({ id, ...payload }: { id: string } & UpdateGroupPayload) =>
      updateGroup(id, payload),
    onSuccess: invalidateAll,
  })

  const deleteGroupMut = useMutation({
    mutationFn: deleteGroup,
    onSuccess: invalidateAll,
  })

  const cancelGroupMut = useMutation({
    mutationFn: cancelGroup,
    onSuccess: invalidateAll,
  })

  const completeGroupMut = useMutation({
    mutationFn: ({ id, ...payload }: { id: string } & BulkAttendancePayload) =>
      completeGroup(id, payload),
    onSuccess: invalidateAll,
  })

  const triggerPaymentMut = useMutation({
    mutationFn: triggerGroupPayment,
    onSuccess: invalidateAll,
  })

  const confirmScheduleMut = useMutation({
    mutationFn: ({ id, ...payload }: { id: string } & ConfirmSchedulePayload) =>
      confirmGroupSchedule(id, payload),
    onSuccess: invalidateAll,
  })

  const enrollPatientMut = useMutation({
    mutationFn: ({ groupId, patientId }: { groupId: string; patientId: string }) =>
      enrollPatientInGroup(groupId, patientId),
    onSuccess: invalidateAll,
  })

  const removeEnrollmentMut = useMutation({
    mutationFn: ({ groupId, enrollmentId }: { groupId: string; enrollmentId: string }) =>
      removeGroupEnrollment(groupId, enrollmentId),
    onSuccess: invalidateAll,
  })

  const bulkAttendanceMut = useMutation({
    mutationFn: ({ groupId, ...payload }: { groupId: string } & BulkAttendancePayload) =>
      bulkConfirmGroupAttendance(groupId, payload),
    onSuccess: invalidateAll,
  })

  const issueCertificateMut = useMutation({
    mutationFn: ({ groupId, enrollmentId }: { groupId: string; enrollmentId: string }) =>
      issueGroupCertificate(groupId, enrollmentId),
    onSuccess: invalidateAll,
  })

  return {
    createGroupMut,
    updateGroupMut,
    deleteGroupMut,
    cancelGroupMut,
    completeGroupMut,
    triggerPaymentMut,
    confirmScheduleMut,
    enrollPatientMut,
    removeEnrollmentMut,
    bulkAttendanceMut,
    issueCertificateMut,
  }
}
