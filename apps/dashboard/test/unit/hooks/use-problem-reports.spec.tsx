import { renderHook, waitFor } from "@testing-library/react"
import { describe, expect, it, vi, beforeEach } from "vitest"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"

const {
  fetchProblemReports,
  createProblemReport,
  updateProblemReportStatus,
} = vi.hoisted(() => ({
  fetchProblemReports: vi.fn(),
  createProblemReport: vi.fn(),
  updateProblemReportStatus: vi.fn(),
}))

vi.mock("@/lib/api/problem-reports", () => ({
  fetchProblemReports,
  createProblemReport,
  updateProblemReportStatus,
}))

import {
  useProblemReports,
  useCreateProblemReport,
  useUpdateProblemReportStatus,
} from "@/hooks/use-problem-reports"

function makeWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  function TestWrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
  TestWrapper.displayName = "TestWrapper"
  return TestWrapper
}

const mockReport = {
  id: "rpt-1",
  tenantId: "tenant-1",
  reporterId: "user-1",
  type: "BUG" as const,
  title: "Button not working",
  description: "Submit button unresponsive",
  status: "OPEN" as const,
  createdAt: "2026-04-12T00:00:00Z",
  updatedAt: "2026-04-12T00:00:00Z",
}

describe("useProblemReports", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("fetches problem reports list", async () => {
    const mockPaginated = {
      data: [mockReport],
      meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
    }
    fetchProblemReports.mockResolvedValueOnce(mockPaginated)

    const { result } = renderHook(() => useProblemReports(), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(fetchProblemReports).toHaveBeenCalledWith({})
    expect(result.current.data).toEqual(mockPaginated)
  })

  it("passes query params to API", async () => {
    const mockPaginated = {
      data: [mockReport],
      meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
    }
    fetchProblemReports.mockResolvedValueOnce(mockPaginated)

    const { result } = renderHook(
      () => useProblemReports({ status: "OPEN", page: 2 }),
      { wrapper: makeWrapper() },
    )

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(fetchProblemReports).toHaveBeenCalledWith({ status: "OPEN", page: 2 })
  })
})

describe("useCreateProblemReport", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("creates a problem report", async () => {
    createProblemReport.mockResolvedValueOnce(mockReport)

    const { result } = renderHook(() => useCreateProblemReport(), { wrapper: makeWrapper() })

    result.current.mutate({
      reporterId: "user-1",
      type: "BUG",
      title: "Button not working",
      description: "Submit button unresponsive",
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(createProblemReport).toHaveBeenCalledWith({
      reporterId: "user-1",
      type: "BUG",
      title: "Button not working",
      description: "Submit button unresponsive",
    })
  })
})

describe("useUpdateProblemReportStatus", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("updates report status", async () => {
    const updatedReport = { ...mockReport, status: "RESOLVED" as const }
    updateProblemReportStatus.mockResolvedValueOnce(updatedReport)

    const { result } = renderHook(() => useUpdateProblemReportStatus(), { wrapper: makeWrapper() })

    result.current.mutate({ id: "rpt-1", status: "RESOLVED" })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(updateProblemReportStatus).toHaveBeenCalledWith("rpt-1", "RESOLVED")
  })
})
