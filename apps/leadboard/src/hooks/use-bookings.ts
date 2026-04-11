import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { bookingsApi } from '@carekit/api-client'
import type {
  BookingListQuery,
  CreateBookingPayload,
  UpdateBookingPayload,
} from '@carekit/api-client'
import { QUERY_KEYS } from '@/lib/query-keys'

export function useBookingStats() {
  return useQuery({
    queryKey: QUERY_KEYS.bookings.stats,
    queryFn: () => bookingsApi.stats(),
  })
}

export function useBookings(query: BookingListQuery = {}) {
  return useQuery({
    queryKey: QUERY_KEYS.bookings.list(query as Record<string, unknown>),
    queryFn: () => bookingsApi.list(query),
  })
}

export function useBooking(id: string) {
  return useQuery({
    queryKey: QUERY_KEYS.bookings.detail(id),
    queryFn: () => bookingsApi.get(id),
    enabled: !!id,
  })
}

export function useCreateBooking() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateBookingPayload) => bookingsApi.create(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.bookings.all })
    },
  })
}

export function useUpdateBooking(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: UpdateBookingPayload) => bookingsApi.update(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.bookings.detail(id) })
      qc.invalidateQueries({ queryKey: QUERY_KEYS.bookings.all })
    },
  })
}
