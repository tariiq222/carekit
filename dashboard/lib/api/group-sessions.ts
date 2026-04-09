import { api } from "@/lib/api"
import type {
  GroupSession,
  GroupEnrollment,
  GroupSessionListQuery,
  CreateGroupSessionPayload,
  UpdateGroupSessionPayload,
  MarkAttendancePayload,
} from "@/lib/types/group-sessions"
import type { PaginatedResponse } from "@/lib/types/common"

// ─── Sessions ───

export async function fetchGroupSessions(
  query: GroupSessionListQuery = {},
): Promise<PaginatedResponse<GroupSession>> {
  return api.get("/group-sessions", query as Record<string, string | number | boolean | undefined>)
}

export async function fetchGroupSession(id: string): Promise<GroupSession> {
  return api.get(`/group-sessions/${id}`)
}

export async function createGroupSession(payload: CreateGroupSessionPayload): Promise<GroupSession> {
  return api.post("/group-sessions", payload)
}

export async function updateGroupSession(id: string, payload: UpdateGroupSessionPayload): Promise<GroupSession> {
  return api.patch(`/group-sessions/${id}`, payload)
}

export async function deleteGroupSession(id: string): Promise<void> {
  return api.delete(`/group-sessions/${id}`)
}

export async function cancelGroupSession(id: string): Promise<void> {
  return api.patch(`/group-sessions/${id}/cancel`, {})
}

export async function completeGroupSession(id: string, payload: MarkAttendancePayload): Promise<void> {
  return api.patch(`/group-sessions/${id}/complete`, payload)
}

// ─── Enrollments ───

export async function enrollPatient(sessionId: string, patientId: string): Promise<GroupEnrollment> {
  return api.post(`/group-sessions/${sessionId}/enroll`, { patientId })
}

export async function removeEnrollment(sessionId: string, enrollmentId: string): Promise<void> {
  return api.delete(`/group-sessions/${sessionId}/enrollments/${enrollmentId}`)
}
