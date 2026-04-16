import { renderHook, waitFor } from "@testing-library/react"
import { describe, expect, it, vi, beforeEach } from "vitest"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"

const {
  fetchRatings,
  submitRating,
} = vi.hoisted(() => ({
  fetchRatings: vi.fn(),
  submitRating: vi.fn(),
}))

vi.mock("@/lib/api/ratings", () => ({
  fetchRatings,
  submitRating,
}))

import {
  useRatings,
  useSubmitRating,
} from "@/hooks/use-ratings"

function makeWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  function TestWrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
  TestWrapper.displayName = "TestWrapper"
  return TestWrapper
}

const mockRating = {
  id: "rating-1",
  bookingId: "booking-1",
  clientId: "client-1",
  employeeId: "emp-1",
  score: 5,
  comment: "Excellent service",
  isPublic: false,
  createdAt: "2026-04-12T00:00:00Z",
}

describe("useRatings", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("fetches ratings list", async () => {
    const mockPaginated = {
      data: [mockRating],
      meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
    }
    fetchRatings.mockResolvedValueOnce(mockPaginated)

    const { result } = renderHook(() => useRatings(), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(fetchRatings).toHaveBeenCalledWith({})
    expect(result.current.data).toEqual(mockPaginated)
  })

  it("passes query params to API", async () => {
    const mockPaginated = {
      data: [mockRating],
      meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
    }
    fetchRatings.mockResolvedValueOnce(mockPaginated)

    const { result } = renderHook(
      () => useRatings({ employeeId: "emp-1", page: 2 }),
      { wrapper: makeWrapper() },
    )

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(fetchRatings).toHaveBeenCalledWith({ employeeId: "emp-1", page: 2 })
  })
})

describe("useSubmitRating", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("submits a rating", async () => {
    submitRating.mockResolvedValueOnce(mockRating)

    const { result } = renderHook(() => useSubmitRating(), { wrapper: makeWrapper() })

    result.current.mutate({
      bookingId: "booking-1",
      clientId: "client-1",
      employeeId: "emp-1",
      score: 5,
      comment: "Excellent service",
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(submitRating).toHaveBeenCalledWith({
      bookingId: "booking-1",
      clientId: "client-1",
      employeeId: "emp-1",
      score: 5,
      comment: "Excellent service",
    })
  })
})
