import { api } from "@/lib/api"
import type {
  Group,
  GroupEnrollment,
  GroupCertificate,
  GroupListQuery,
  CreateGroupPayload,
  UpdateGroupPayload,
  BulkAttendancePayload,
  ConfirmSchedulePayload,
  ConfirmAttendancePayload,
} from "@/lib/types/groups"
import type { PaginatedResponse } from "@/lib/types/common"

// ─── Groups ───

export async function fetchGroups(
  query: GroupListQuery = {},
): Promise<PaginatedResponse<Group>> {
  return api.get("/groups", query as Record<string, string | number | boolean | undefined>)
}

export async function fetchGroup(id: string): Promise<Group> {
  return api.get(`/groups/${id}`)
}

export async function createGroup(payload: CreateGroupPayload): Promise<Group> {
  return api.post("/groups", payload)
}

export async function updateGroup(id: string, payload: UpdateGroupPayload): Promise<Group> {
  return api.patch(`/groups/${id}`, payload)
}

export async function deleteGroup(id: string): Promise<void> {
  return api.delete(`/groups/${id}`)
}

export async function cancelGroup(id: string): Promise<void> {
  return api.patch(`/groups/${id}/cancel`, {})
}

export async function completeGroup(id: string, payload: BulkAttendancePayload): Promise<void> {
  return api.patch(`/groups/${id}/complete`, payload)
}

export async function triggerGroupPayment(id: string): Promise<void> {
  return api.patch(`/groups/${id}/trigger-payment`, {})
}

export async function confirmGroupSchedule(id: string, payload: ConfirmSchedulePayload): Promise<Group> {
  return api.patch(`/groups/${id}/confirm-schedule`, payload)
}

// ─── Enrollments ───

export async function enrollPatientInGroup(groupId: string, patientId: string): Promise<GroupEnrollment> {
  return api.post(`/groups/${groupId}/enroll`, { patientId })
}

export async function removeGroupEnrollment(groupId: string, enrollmentId: string): Promise<void> {
  return api.delete(`/groups/${groupId}/enrollments/${enrollmentId}`)
}

// ─── Attendance ───

export async function bulkConfirmGroupAttendance(
  groupId: string,
  payload: BulkAttendancePayload,
): Promise<void> {
  return api.patch(`/groups/${groupId}/bulk-attendance`, payload)
}

// ─── Certificates ───

export async function issueGroupCertificate(
  groupId: string,
  enrollmentId: string,
): Promise<GroupCertificate> {
  return api.post(`/groups/${groupId}/enrollments/${enrollmentId}/certificate`, {})
}

// ─── Resend Payment ───

export async function resendEnrollmentPayment(
  groupId: string,
  enrollmentId: string,
): Promise<void> {
  return api.patch(`/groups/${groupId}/enrollments/${enrollmentId}/resend-payment`, {})
}

// ─── Single Attendance ───

export async function confirmEnrollmentAttendance(
  groupId: string,
  payload: ConfirmAttendancePayload,
): Promise<GroupEnrollment> {
  return api.patch<GroupEnrollment>(`/groups/${groupId}/attendance`, payload)
}
