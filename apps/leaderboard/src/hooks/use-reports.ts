import { useQuery } from '@tanstack/react-query'
import { reportsApi } from '@carekit/api-client'
import type { ReportDateParams } from '@carekit/api-client'
import { QUERY_KEYS } from '@/lib/query-keys'

export function useRevenueReport(params: ReportDateParams = {}) {
  return useQuery({
    queryKey: QUERY_KEYS.reports.revenue(params as Record<string, unknown>),
    queryFn: () => reportsApi.revenue(params),
  })
}

export function useBookingReport(params: ReportDateParams = {}) {
  return useQuery({
    queryKey: QUERY_KEYS.reports.bookings(params as Record<string, unknown>),
    queryFn: () => reportsApi.bookings(params),
  })
}

export function useDashboardStats() {
  return useQuery({
    queryKey: QUERY_KEYS.reports.dashboard,
    queryFn: () => reportsApi.dashboard(),
  })
}
