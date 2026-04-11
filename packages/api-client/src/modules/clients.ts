import { apiRequest } from '../client.js'
import { buildQueryString } from '../types/api.js'
import type {
  PatientListItem,
  PatientListQuery,
  PatientListResponse,
  PatientStats,
  CreateWalkInPayload,
  UpdatePatientPayload,
} from '../types/patient.js'

export async function list(query: PatientListQuery = {}): Promise<PatientListResponse> {
  return apiRequest<PatientListResponse>(
    `/patients${buildQueryString(query as Record<string, unknown>)}`,
  )
}

export async function stats(): Promise<PatientStats> {
  return apiRequest<PatientStats>('/patients/list-stats')
}

export async function get(id: string): Promise<PatientListItem> {
  return apiRequest<PatientListItem>(`/patients/${id}`)
}

export async function update(
  id: string,
  payload: UpdatePatientPayload,
): Promise<PatientListItem> {
  return apiRequest<PatientListItem>(`/patients/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export async function createWalkIn(
  payload: CreateWalkInPayload,
): Promise<PatientListItem> {
  return apiRequest<PatientListItem>('/patients/walk-in', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}
