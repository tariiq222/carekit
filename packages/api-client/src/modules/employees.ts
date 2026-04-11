import { apiRequest } from '../client.js'
import { buildQueryString } from '../types/api.js'
import type {
  PractitionerListItem,
  PractitionerListQuery,
  PractitionerListResponse,
  PractitionerStats,
  CreatePractitionerPayload,
  UpdatePractitionerPayload,
  PractitionerBreak,
  SetBreaksPayload,
  PractitionerVacation,
  CreateVacationPayload,
  PractitionerService,
  AssignPractitionerServicePayload,
  UpdatePractitionerServicePayload,
} from '../types/practitioner.js'

export async function list(
  query: PractitionerListQuery = {},
): Promise<PractitionerListResponse> {
  return apiRequest<PractitionerListResponse>(
    `/practitioners${buildQueryString(query as Record<string, unknown>)}`,
  )
}

export async function get(id: string): Promise<PractitionerListItem> {
  return apiRequest<PractitionerListItem>(`/practitioners/${id}`)
}

export async function create(
  payload: CreatePractitionerPayload,
): Promise<PractitionerListItem> {
  return apiRequest<PractitionerListItem>('/practitioners', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function update(
  id: string,
  payload: UpdatePractitionerPayload,
): Promise<PractitionerListItem> {
  return apiRequest<PractitionerListItem>(`/practitioners/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export async function remove(id: string): Promise<void> {
  return apiRequest<void>(`/practitioners/${id}`, { method: 'DELETE' })
}

// ─── Breaks ────────────────────────────────────────────────────────────────

export async function getBreaks(practitionerId: string): Promise<PractitionerBreak[]> {
  return apiRequest<PractitionerBreak[]>(`/practitioners/${practitionerId}/breaks`)
}

export async function setBreaks(
  practitionerId: string,
  payload: SetBreaksPayload,
): Promise<PractitionerBreak[]> {
  return apiRequest<PractitionerBreak[]>(`/practitioners/${practitionerId}/breaks`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

// ─── Vacations ─────────────────────────────────────────────────────────────

export async function getVacations(practitionerId: string): Promise<PractitionerVacation[]> {
  return apiRequest<PractitionerVacation[]>(`/practitioners/${practitionerId}/vacations`)
}

export async function createVacation(
  practitionerId: string,
  payload: CreateVacationPayload,
): Promise<PractitionerVacation> {
  return apiRequest<PractitionerVacation>(`/practitioners/${practitionerId}/vacations`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function deleteVacation(
  practitionerId: string,
  vacationId: string,
): Promise<void> {
  return apiRequest<void>(`/practitioners/${practitionerId}/vacations/${vacationId}`, {
    method: 'DELETE',
  })
}

// ─── Services ──────────────────────────────────────────────────────────────

export async function listServices(practitionerId: string): Promise<PractitionerService[]> {
  return apiRequest<PractitionerService[]>(`/practitioners/${practitionerId}/services`)
}

export async function assignService(
  practitionerId: string,
  payload: AssignPractitionerServicePayload,
): Promise<PractitionerService> {
  return apiRequest<PractitionerService>(`/practitioners/${practitionerId}/services`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function updateService(
  practitionerId: string,
  serviceId: string,
  payload: UpdatePractitionerServicePayload,
): Promise<PractitionerService> {
  return apiRequest<PractitionerService>(
    `/practitioners/${practitionerId}/services/${serviceId}`,
    {
      method: 'PATCH',
      body: JSON.stringify(payload),
    },
  )
}

export async function removeService(
  practitionerId: string,
  serviceId: string,
): Promise<void> {
  return apiRequest<void>(`/practitioners/${practitionerId}/services/${serviceId}`, {
    method: 'DELETE',
  })
}

// ─── Stats ─────────────────────────────────────────────────────────────────

export async function stats(): Promise<PractitionerStats> {
  const [activeRes, allRes] = await Promise.all([
    list({ isActive: true, perPage: 1 }),
    list({ perPage: 1 }),
  ])
  const active = activeRes.meta.total
  const total = allRes.meta.total
  return {
    total,
    active,
    inactive: total - active,
    newThisMonth: 0,
  }
}
