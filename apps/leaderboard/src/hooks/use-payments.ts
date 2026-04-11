import { useQuery } from '@tanstack/react-query'
import { paymentsApi } from '@carekit/api-client'
import type { PaymentListQuery } from '@carekit/api-client'
import { QUERY_KEYS } from '@/lib/query-keys'

export function usePaymentStats() {
  return useQuery({
    queryKey: QUERY_KEYS.payments.stats,
    queryFn: () => paymentsApi.stats(),
  })
}

export function usePayments(query: PaymentListQuery = {}) {
  return useQuery({
    queryKey: QUERY_KEYS.payments.list(query as Record<string, unknown>),
    queryFn: () => paymentsApi.list(query),
  })
}

export function usePayment(id: string) {
  return useQuery({
    queryKey: QUERY_KEYS.payments.detail(id),
    queryFn: () => paymentsApi.get(id),
    enabled: !!id,
  })
}
