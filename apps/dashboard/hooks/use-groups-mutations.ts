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
  enrollClientInGroup,
  removeGroupEnrollment,
  bulkConfirmGroupAttendance,
  issueGroupCertificate,
  resendEnrollmentPayment,
  confirmEnrollmentAttendance,
} from "@/lib/api/groups"
import type { UpdateGroupPayload, BulkAttendancePayload, ConfirmSchedulePayload, ConfirmAttendancePayload } from "@/lib/types/groups"

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

  const enrollClientMut = useMutation({
    mutationFn: ({ groupId, clientId }: { groupId: string; clientId: string }) =>
      enrollClientInGroup(groupId, clientId),
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

  const resendPaymentMut = useMutation({
    mutationFn: ({ groupId, enrollmentId }: { groupId: string; enrollmentId: string }) =>
      resendEnrollmentPayment(groupId, enrollmentId),
    onSuccess: invalidateAll,
  })

  const confirmAttendanceMut = useMutation({
    mutationFn: ({ groupId, ...payload }: { groupId: string } & ConfirmAttendancePayload) =>
      confirmEnrollmentAttendance(groupId, payload),
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
    enrollClientMut,
    removeEnrollmentMut,
    bulkAttendanceMut,
    issueCertificateMut,
    resendPaymentMut,
    confirmAttendanceMut,
  }
}
