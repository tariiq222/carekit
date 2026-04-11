import { apiRequest } from '../client.js'
import type {
  SpecialtyListItem,
  CreateSpecialtyPayload,
  UpdateSpecialtyPayload,
} from '../types/specialty.js'

export async function list(): Promise<SpecialtyListItem[]> {
  return apiRequest<SpecialtyListItem[]>('/specialties')
}

export async function get(id: string): Promise<SpecialtyListItem> {
  return apiRequest<SpecialtyListItem>(`/specialties/${id}`)
}

export async function create(
  payload: CreateSpecialtyPayload,
): Promise<SpecialtyListItem> {
  return apiRequest<SpecialtyListItem>('/specialties', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function update(
  id: string,
  payload: UpdateSpecialtyPayload,
): Promise<SpecialtyListItem> {
  return apiRequest<SpecialtyListItem>(`/specialties/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export async function remove(id: string): Promise<{ deleted: boolean }> {
  return apiRequest<{ deleted: boolean }>(`/specialties/${id}`, {
    method: 'DELETE',
  })
}
