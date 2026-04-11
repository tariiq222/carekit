import { apiRequest } from '../client.js'
import { buildQueryString } from '../types/api.js'
import type {
  CreateGiftCardPayload,
  GiftCardListItem,
  GiftCardListQuery,
  GiftCardListResponse,
  UpdateGiftCardPayload,
} from '../types/gift-card.js'

export async function list(
  query: GiftCardListQuery = {},
): Promise<GiftCardListResponse> {
  return apiRequest<GiftCardListResponse>(
    `/gift-cards${buildQueryString(query as Record<string, unknown>)}`,
  )
}

export async function get(id: string): Promise<GiftCardListItem> {
  return apiRequest<GiftCardListItem>(`/gift-cards/${id}`)
}

export async function create(
  payload: CreateGiftCardPayload,
): Promise<GiftCardListItem> {
  return apiRequest<GiftCardListItem>('/gift-cards', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function update(
  id: string,
  payload: UpdateGiftCardPayload,
): Promise<GiftCardListItem> {
  return apiRequest<GiftCardListItem>(`/gift-cards/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export async function remove(id: string): Promise<{ deactivated: true }> {
  return apiRequest<{ deactivated: true }>(`/gift-cards/${id}`, {
    method: 'DELETE',
  })
}
