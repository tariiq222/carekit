import React from "react"
import { renderHook, waitFor, act } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ReactNode } from "react"

const { fetchProblemReports, resolveProblemReport } = vi.hoisted(() => ({
  fetchProblemReports: vi.fn(),
  resolveProblemReport: vi.fn(),
}))

vi.mock("@/lib/api/problem-reports", () => ({
  fetchProblemReports,
  resolveProblemReport,
}))

import {
  useProblemReports,
  useResolveProblemReport,
} from "@/hooks/use-problem-reports"

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  function TestWrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
  TestWrapper.displayName = "TestWrapper"
  return TestWrapper
}

describe("useProblemReports", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns empty reports and null meta while loading", () => {
    fetchProblemReports.mockReturnValue(new Promise(() => {}))
    const { result } = renderHook(() => useProblemReports(), {
      wrapper: makeWrapper(),
    })
    expect(result.current.reports).toEqual([])
    expect(result.current.meta).toBeNull()
    expect(result.current.isLoading).toBe(true)
  })

  it("fetches problem reports and exposes items and meta", async () => {
    const mockResponse = {
      items: [{ id: "pr-1", status: "OPEN" }],
      meta: { total: 1, page: 1, perPage: 20 },
    }
    fetchProblemReports.mockResolvedValueOnce(mockResponse)

    const { result } = renderHook(() => useProblemReports(), {
      wrapper: makeWrapper(),
    })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.reports).toEqual(mockResponse.items)
    expect(result.current.meta).toEqual(mockResponse.meta)
    expect(result.current.error).toBeNull()
  })

  it("surfaces error message on fetch failure", async () => {
    fetchProblemReports.mockRejectedValueOnce(new Error("forbidden"))

    const { result } = renderHook(() => useProblemReports(), {
      wrapper: makeWrapper(),
    })

    await waitFor(() => expect(result.current.error).toBe("forbidden"))
    expect(result.current.reports).toEqual([])
  })

  it("resets page to 1 when status filter changes", async () => {
    fetchProblemReports.mockResolvedValue({ items: [], meta: { total: 0 } })

    const { result } = renderHook(() => useProblemReports(), {
      wrapper: makeWrapper(),
    })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    act(() => result.current.setPage(3))
    expect(result.current.page).toBe(3)

    act(() => result.current.setStatus("RESOLVED" as Parameters<typeof result.current.setStatus>[0]))
    expect(result.current.page).toBe(1)
  })

  it("resetFilters clears status and resets page to 1", async () => {
    fetchProblemReports.mockResolvedValue({ items: [], meta: { total: 0 } })

    const { result } = renderHook(() => useProblemReports(), {
      wrapper: makeWrapper(),
    })

    act(() => {
      result.current.setPage(2)
      result.current.setStatus("OPEN" as Parameters<typeof result.current.setStatus>[0])
    })

    act(() => result.current.resetFilters())

    expect(result.current.status).toBeUndefined()
    expect(result.current.page).toBe(1)
  })
})

describe("useResolveProblemReport", () => {
  beforeEach(() => vi.clearAllMocks())

  it("is idle before being called", () => {
    const { result } = renderHook(() => useResolveProblemReport(), {
      wrapper: makeWrapper(),
    })
    expect(result.current.isPending).toBe(false)
    expect(result.current.isIdle).toBe(true)
  })

  it("calls resolveProblemReport with split id and payload", async () => {
    const mockReport = { id: "pr-1", status: "RESOLVED" }
    resolveProblemReport.mockResolvedValueOnce(mockReport)

    const { result } = renderHook(() => useResolveProblemReport(), {
      wrapper: makeWrapper(),
    })

    await act(async () => {
      await result.current.mutateAsync({ id: "pr-1", status: "resolved" })
    })

    expect(resolveProblemReport).toHaveBeenCalledWith("pr-1", {
      status: "resolved",
    })
  })

  it("invalidates problemReports queries on success", async () => {
    resolveProblemReport.mockResolvedValueOnce({ id: "pr-1" })

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries")

    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )

    const { result } = renderHook(() => useResolveProblemReport(), { wrapper })

    await act(async () => {
      await result.current.mutateAsync({ id: "pr-1", status: "resolved" })
    })

    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ["problem-reports"] }),
    )
  })
})
