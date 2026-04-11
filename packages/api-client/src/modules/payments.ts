import { apiRequest } from '../client.js'
import { buildQueryString } from '../types/api.js'
import type {
  PaymentListItem,
  PaymentListQuery,
  PaymentListResponse,
  PaymentStats,
} from '../types/payment.js'

export async function list(
  query: PaymentListQuery = {},
): Promise<PaymentListResponse> {
  return apiRequest<PaymentListResponse>(
    `/payments${buildQueryString(query as Record<string, unknown>)}`,
  )
}

export async function stats(): Promise<PaymentStats> {
  return apiRequest<PaymentStats>('/payments/stats')
}

export async function get(id: string): Promise<PaymentListItem> {
  return apiRequest<PaymentListItem>(`/payments/${id}`)
}
