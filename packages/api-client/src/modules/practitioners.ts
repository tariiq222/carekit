import { apiRequest } from '../client.js'
import { buildQueryString } from '../types/api.js'
import type {
  PractitionerListItem,
  PractitionerListQuery,
  PractitionerListResponse,
  PractitionerStats,
  CreatePractitionerPayload,
  UpdatePractitionerPayload,
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
