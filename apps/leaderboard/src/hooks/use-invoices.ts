import { useQuery } from '@tanstack/react-query'
import { invoicesApi } from '@carekit/api-client'
import type { InvoiceListQuery } from '@carekit/api-client'
import { QUERY_KEYS } from '@/lib/query-keys'

export function useInvoiceStats() {
  return useQuery({
    queryKey: QUERY_KEYS.invoices.stats,
    queryFn: () => invoicesApi.stats(),
  })
}

export function useInvoices(query: InvoiceListQuery = {}) {
  return useQuery({
    queryKey: QUERY_KEYS.invoices.list(query as Record<string, unknown>),
    queryFn: () => invoicesApi.list(query),
  })
}

export function useInvoice(id: string) {
  return useQuery({
    queryKey: QUERY_KEYS.invoices.detail(id),
    queryFn: () => invoicesApi.get(id),
    enabled: !!id,
  })
}

export function useInvoiceHtmlPath(id: string): string {
  return invoicesApi.getHtmlPath(id)
}
