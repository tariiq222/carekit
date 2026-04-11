"use client"

import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query"
import { useState, useCallback } from "react"
import { queryKeys } from "@/lib/query-keys"
import {
  fetchBookings,
  fetchBookingStats,
  createBooking,
  rescheduleBooking,
  confirmBooking,
  completeBooking,
  markNoShow,
  approveCancellation,
  rejectCancellation,
  checkInBooking,
  startBooking,
  adminCancelBooking,
  employeeCancelBooking,
  requestCancellation,
  createRecurringBooking,
  clientReschedule,
} from "@/lib/api/bookings"
import type {
  BookingStatus,
  BookingType,
  BookingListQuery,
} from "@/lib/types/booking"

/* ─── Filters ─── */

interface BookingFilters {
  status: BookingStatus | "all"
  type: BookingType | "all"
  dateFrom: string
  dateTo: string
  employeeId: string
}

const defaultFilters: BookingFilters = {
  status: "all",
  type: "all",
  dateFrom: "",
  dateTo: "",
  employeeId: "",
}

/* ─── List Hook ─── */

export function useBookings() {
  const [page, setPage] = useState(1)
  const [filters, setFiltersState] = useState<BookingFilters>(defaultFilters)

  const hasFilters =
    filters.status !== "all" ||
    filters.type !== "all" ||
    filters.dateFrom !== "" ||
    filters.dateTo !== "" ||
    filters.employeeId !== ""

  const query: BookingListQuery = {
    page,
    perPage: 20,
    status: filters.status !== "all" ? filters.status : undefined,
    type: filters.type !== "all" ? filters.type : undefined,
    dateFrom: filters.dateFrom || undefined,
    dateTo: filters.dateTo || undefined,
    employeeId: filters.employeeId || undefined,
  }

  const {
    data: bookingsData,
    isLoading: bookingsLoading,
    error: bookingsError,
  } = useQuery({
    queryKey: queryKeys.bookings.list(query),
    queryFn: () => fetchBookings(query),
    placeholderData: keepPreviousData,
  })

  const {
    data: stats,
    isLoading: statsLoading,
  } = useQuery({
    queryKey: queryKeys.bookings.stats(),
    queryFn: fetchBookingStats,
    staleTime: 60_000,
  })

  const setFilters = useCallback((partial: Partial<BookingFilters>) => {
    setFiltersState((prev) => ({ ...prev, ...partial }))
    setPage(1)
  }, [])

  const resetFilters = useCallback(() => {
    setFiltersState(defaultFilters)
    setPage(1)
  }, [])

  return {
    bookings: bookingsData?.items ?? [],
    meta: bookingsData?.meta ?? null,
    stats: stats ?? null,
    loading: bookingsLoading,
    statsLoading,
    error: bookingsError?.message ?? null,
    filters,
    setFilters,
    resetFilters,
    setPage,
    hasFilters,
  }
}

/* ─── Stats Hook ─── */

export function useBookingStats() {
  return useQuery({
    queryKey: queryKeys.bookings.stats(),
    queryFn: fetchBookingStats,
    staleTime: 60_000,
  })
}

/* ─── Today's Bookings Hook ─── */

export function useTodayBookings(date: string) {
  const query: BookingListQuery = { dateFrom: date, dateTo: date, perPage: 10 }
  return useQuery({
    queryKey: queryKeys.bookings.list(query),
    queryFn: () => fetchBookings(query),
    staleTime: 30_000,
  })
}

/* ─── Mutations ─── */

export function useBookingMutations() {
  const queryClient = useQueryClient()
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.bookings.all })

  const createMut = useMutation({
    mutationFn: createBooking,
    onSuccess: invalidate,
  })

  const rescheduleMut = useMutation({
    mutationFn: ({ id, ...payload }: { id: string } & Parameters<typeof rescheduleBooking>[1]) =>
      rescheduleBooking(id, payload),
    onSuccess: invalidate,
  })

  const confirmMut = useMutation({
    mutationFn: confirmBooking,
    onSuccess: invalidate,
  })

  const completeMut = useMutation({
    mutationFn: completeBooking,
    onSuccess: invalidate,
  })

  const noShowMut = useMutation({
    mutationFn: markNoShow,
    onSuccess: invalidate,
  })

  const approveCancelMut = useMutation({
    mutationFn: ({ id, ...payload }: { id: string } & Parameters<typeof approveCancellation>[1]) =>
      approveCancellation(id, payload),
    onSuccess: invalidate,
  })

  const rejectCancelMut = useMutation({
    mutationFn: ({ id, ...payload }: { id: string } & Parameters<typeof rejectCancellation>[1]) =>
      rejectCancellation(id, payload),
    onSuccess: invalidate,
  })

  const checkInMut = useMutation({
    mutationFn: checkInBooking,
    onSuccess: invalidate,
  })

  const startMut = useMutation({
    mutationFn: startBooking,
    onSuccess: invalidate,
  })

  const adminCancelMut = useMutation({
    mutationFn: ({ id, ...payload }: { id: string } & Parameters<typeof adminCancelBooking>[1]) =>
      adminCancelBooking(id, payload),
    onSuccess: invalidate,
  })

  const employeeCancelMut = useMutation({
    mutationFn: ({ id, ...payload }: { id: string } & Parameters<typeof employeeCancelBooking>[1]) =>
      employeeCancelBooking(id, payload),
    onSuccess: invalidate,
  })

  const cancelRequestMut = useMutation({
    mutationFn: ({ id, ...payload }: { id: string } & Parameters<typeof requestCancellation>[1]) =>
      requestCancellation(id, payload),
    onSuccess: invalidate,
  })

  const recurringMut = useMutation({
    mutationFn: createRecurringBooking,
    onSuccess: invalidate,
  })

  const clientRescheduleMut = useMutation({
    mutationFn: ({ id, ...payload }: { id: string } & Parameters<typeof clientReschedule>[1]) =>
      clientReschedule(id, payload),
    onSuccess: invalidate,
  })

  return {
    createMut,
    rescheduleMut,
    confirmMut,
    completeMut,
    noShowMut,
    approveCancelMut,
    rejectCancelMut,
    checkInMut,
    startMut,
    adminCancelMut,
    employeeCancelMut,
    cancelRequestMut,
    recurringMut,
    clientRescheduleMut,
  }
}
