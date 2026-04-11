import { apiRequest } from '../client.js'
import { buildQueryString } from '../types/api.js'
import type {
  ClientListItem,
  ClientListQuery,
  ClientListResponse,
  ClientStats,
  CreateWalkInPayload,
  UpdateClientPayload,
} from '../types/client.js'

export async function list(query: ClientListQuery = {}): Promise<ClientListResponse> {
  return apiRequest<ClientListResponse>(
    `/clients${buildQueryString(query as Record<string, unknown>)}`,
  )
}

export async function stats(): Promise<ClientStats> {
  return apiRequest<ClientStats>('/clients/list-stats')
}

export async function get(id: string): Promise<ClientListItem> {
  return apiRequest<ClientListItem>(`/clients/${id}`)
}

export async function update(
  id: string,
  payload: UpdateClientPayload,
): Promise<ClientListItem> {
  return apiRequest<ClientListItem>(`/clients/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export async function createWalkIn(
  payload: CreateWalkInPayload,
): Promise<ClientListItem> {
  return apiRequest<ClientListItem>('/clients/walk-in', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}
