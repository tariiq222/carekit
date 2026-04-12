import { beforeEach, describe, expect, it, vi } from "vitest"

const { getMock, postMock, patchMock, deleteMock, putMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn(),
  patchMock: vi.fn(),
  deleteMock: vi.fn(),
  putMock: vi.fn(),
}))

vi.mock("@/lib/api", () => ({
  api: { get: getMock, post: postMock, patch: patchMock, delete: deleteMock, put: putMock },
  getAccessToken: vi.fn().mockReturnValue(null),
}))

import {
  fetchRevenueReport,
  fetchBookingReport,
  fetchEmployeeReport,
} from "@/lib/api/reports"

describe("reports api", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("fetchRevenueReport calls /reports/revenue with query", async () => {
    getMock.mockResolvedValueOnce({})
    await fetchRevenueReport({ dateFrom: "2026-01-01", dateTo: "2026-01-31" })
    expect(getMock).toHaveBeenCalledWith(
      "/reports/revenue",
      expect.objectContaining({ dateFrom: "2026-01-01", dateTo: "2026-01-31" }),
    )
  })

  it("fetchBookingReport calls /reports/bookings with query", async () => {
    getMock.mockResolvedValueOnce({})
    await fetchBookingReport({ dateFrom: "2026-01-01", dateTo: "2026-01-31" })
    expect(getMock).toHaveBeenCalledWith(
      "/reports/bookings",
      expect.objectContaining({ dateFrom: "2026-01-01", dateTo: "2026-01-31" }),
    )
  })

  it("fetchEmployeeReport calls /reports/employees with employeeId", async () => {
    getMock.mockResolvedValueOnce({})
    await fetchEmployeeReport({ employeeId: "p-1", dateFrom: "2026-01-01", dateTo: "2026-01-31" })
    expect(getMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ dateFrom: "2026-01-01" }),
    )
  })
})
