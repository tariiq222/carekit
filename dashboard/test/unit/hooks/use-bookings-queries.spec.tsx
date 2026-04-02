import { renderHook, waitFor, act } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ReactNode } from "react"

const {
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
  practitionerCancelBooking,
  requestCancellation,
  createRecurringBooking,
  patientReschedule,
} = vi.hoisted(() => ({
  fetchBookings: vi.fn(),
  fetchBookingStats: vi.fn(),
  createBooking: vi.fn(),
  rescheduleBooking: vi.fn(),
  confirmBooking: vi.fn(),
  completeBooking: vi.fn(),
  markNoShow: vi.fn(),
  approveCancellation: vi.fn(),
  rejectCancellation: vi.fn(),
  checkInBooking: vi.fn(),
  startBooking: vi.fn(),
  adminCancelBooking: vi.fn(),
  practitionerCancelBooking: vi.fn(),
  requestCancellation: vi.fn(),
  createRecurringBooking: vi.fn(),
  patientReschedule: vi.fn(),
}))

vi.mock("@/lib/api/bookings", () => ({
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
  practitionerCancelBooking,
  requestCancellation,
  createRecurringBooking,
  patientReschedule,
}))

import { useBookings, useBookingStats, useTodayBookings } from "@/hooks/use-bookings"

function makeWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  function TestWrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
  TestWrapper.displayName = "TestWrapper"
  return TestWrapper
}

describe("useBookings", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("fetches bookings and returns items", async () => {
    const items = [{ id: "bk-1", status: "PENDING" }]
    fetchBookings.mockResolvedValue({ items, meta: { total: 1 } })
    fetchBookingStats.mockResolvedValue({ pending: 2 })

    const { result } = renderHook(() => useBookings(), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(fetchBookings).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, perPage: 20 }),
    )
    expect(result.current.bookings).toEqual(items)
    expect(result.current.meta).toEqual({ total: 1 })
  })

  it("returns empty bookings initially", () => {
    fetchBookings.mockReturnValueOnce(new Promise(() => undefined))
    fetchBookingStats.mockReturnValueOnce(new Promise(() => undefined))

    const { result } = renderHook(() => useBookings(), { wrapper: makeWrapper() })

    expect(result.current.loading).toBe(true)
    expect(result.current.bookings).toEqual([])
    expect(result.current.meta).toBeNull()
  })

  it("setFilters applies status filter and resets page", async () => {
    fetchBookings.mockResolvedValue({ items: [], meta: { total: 0 } })
    fetchBookingStats.mockResolvedValue({})

    const { result } = renderHook(() => useBookings(), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => { result.current.setFilters({ status: "confirmed" }) })

    await waitFor(() =>
      expect(fetchBookings).toHaveBeenCalledWith(
        expect.objectContaining({ status: "confirmed", page: 1 }),
      ),
    )
  })

  it("resetFilters clears all filters", async () => {
    fetchBookings.mockResolvedValue({ items: [], meta: { total: 0 } })
    fetchBookingStats.mockResolvedValue({})

    const { result } = renderHook(() => useBookings(), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => { result.current.setFilters({ status: "confirmed", practitionerId: "p-1" }) })
    act(() => { result.current.resetFilters() })

    await waitFor(() => {
      expect(result.current.filters.status).toBe("all")
      expect(result.current.filters.practitionerId).toBe("")
      expect(result.current.hasFilters).toBe(false)
    })
  })

  it("exposes stats from booking stats query", async () => {
    fetchBookings.mockResolvedValue({ items: [], meta: { total: 0 } })
    fetchBookingStats.mockResolvedValue({ pending: 5, pendingCancellation: 2 })

    const { result } = renderHook(() => useBookings(), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.statsLoading).toBe(false))

    expect(result.current.stats).toEqual({ pending: 5, pendingCancellation: 2 })
  })
})

describe("useBookingStats", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("fetches booking stats", async () => {
    fetchBookingStats.mockResolvedValueOnce({ pending: 3, confirmed: 10 })

    const { result } = renderHook(() => useBookingStats(), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(fetchBookingStats).toHaveBeenCalled()
    expect(result.current.data).toEqual({ pending: 3, confirmed: 10 })
  })
})

describe("useTodayBookings", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("fetches bookings with dateFrom and dateTo set to the provided date", async () => {
    const items = [{ id: "bk-today" }]
    fetchBookings.mockResolvedValueOnce({ items, meta: { total: 1 } })

    const { result } = renderHook(
      () => useTodayBookings("2026-03-27"),
      { wrapper: makeWrapper() },
    )

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(fetchBookings).toHaveBeenCalledWith(
      expect.objectContaining({
        dateFrom: "2026-03-27",
        dateTo: "2026-03-27",
        perPage: 10,
      }),
    )
    expect(result.current.data?.items).toEqual(items)
  })
})
