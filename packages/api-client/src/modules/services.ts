import { apiRequest } from '../client.js'
import { buildQueryString } from '../types/api.js'
import type {
  ServiceListItem,
  ServiceListQuery,
  ServiceListResponse,
  ServiceStats,
  CreateServicePayload,
  UpdateServicePayload,
} from '../types/service.js'

export async function list(query: ServiceListQuery = {}): Promise<ServiceListResponse> {
  return apiRequest<ServiceListResponse>(
    `/services${buildQueryString(query as Record<string, unknown>)}`,
  )
}

export async function stats(): Promise<ServiceStats> {
  return apiRequest<ServiceStats>('/services/list-stats')
}

export async function get(id: string): Promise<ServiceListItem> {
  return apiRequest<ServiceListItem>(`/services/${id}`)
}

export async function create(payload: CreateServicePayload): Promise<ServiceListItem> {
  return apiRequest<ServiceListItem>('/services', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function update(
  id: string,
  payload: UpdateServicePayload,
): Promise<ServiceListItem> {
  return apiRequest<ServiceListItem>(`/services/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export async function remove(id: string): Promise<{ deleted: boolean }> {
  return apiRequest<{ deleted: boolean }>(`/services/${id}`, {
    method: 'DELETE',
  })
}
