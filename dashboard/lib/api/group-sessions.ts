import { api } from "@/lib/api"
import type {
  GroupOffering,
  GroupSession,
  GroupEnrollment,
  OfferingListQuery,
  SessionListQuery,
  CreateOfferingPayload,
  UpdateOfferingPayload,
  CreateSessionPayload,
  MarkAttendancePayload,
} from "@/lib/types/group-sessions"
import type { PaginatedResponse } from "@/lib/types/common"

// ─── Offerings ───

export async function fetchOfferings(
  query: OfferingListQuery = {},
): Promise<PaginatedResponse<GroupOffering>> {
  return api.get("/group-sessions/offerings", query as Record<string, string | number | boolean | undefined>)
}

export async function fetchOffering(id: string): Promise<GroupOffering> {
  return api.get(`/group-sessions/offerings/${id}`)
}

export async function createOffering(payload: CreateOfferingPayload): Promise<GroupOffering> {
  return api.post("/group-sessions/offerings", payload)
}

export async function updateOffering(id: string, payload: UpdateOfferingPayload): Promise<GroupOffering> {
  return api.patch(`/group-sessions/offerings/${id}`, payload)
}

export async function deleteOffering(id: string): Promise<void> {
  return api.delete(`/group-sessions/offerings/${id}`)
}

// ─── Sessions ───

export async function fetchSessions(
  query: SessionListQuery = {},
): Promise<PaginatedResponse<GroupSession>> {
  return api.get("/group-sessions/sessions", query as Record<string, string | number | boolean | undefined>)
}

export async function fetchSession(id: string): Promise<GroupSession> {
  return api.get(`/group-sessions/sessions/${id}`)
}

export async function createSession(offeringId: string, payload: CreateSessionPayload): Promise<GroupSession> {
  return api.post(`/group-sessions/offerings/${offeringId}/sessions`, payload)
}

export async function cancelSession(id: string): Promise<void> {
  return api.patch(`/group-sessions/sessions/${id}/cancel`, {})
}

export async function completeSession(id: string, payload: MarkAttendancePayload): Promise<void> {
  return api.post(`/group-sessions/sessions/${id}/attendance`, payload)
}

// ─── Enrollments ───

export async function enrollPatient(sessionId: string, patientId: string): Promise<GroupEnrollment> {
  return api.post(`/group-sessions/sessions/${sessionId}/enroll`, { patientId })
}

export async function cancelEnrollment(sessionId: string, enrollmentId: string, patientId: string): Promise<void> {
  return api.patch(`/group-sessions/sessions/${sessionId}/enrollments/${enrollmentId}/cancel`, { patientId })
}

export async function removeEnrollment(sessionId: string, enrollmentId: string): Promise<void> {
  return api.delete(`/group-sessions/sessions/${sessionId}/enrollments/${enrollmentId}`)
}
