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
  fetchPractitionerReport,
  exportRevenueCsv,
  exportBookingsCsv,
  exportPatientsCsv,
} from "@/lib/api/reports"

// Minimal fetch stub for downloadCsv
const fetchMock = vi.fn().mockResolvedValue({
  blob: () => Promise.resolve(new Blob()),
})
vi.stubGlobal("fetch", fetchMock)
vi.stubGlobal("URL", {
  createObjectURL: vi.fn().mockReturnValue("blob:mock"),
  revokeObjectURL: vi.fn(),
})

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

  it("fetchPractitionerReport calls /reports/practitioners/:id", async () => {
    getMock.mockResolvedValueOnce({})
    await fetchPractitionerReport("p-1", { dateFrom: "2026-01-01", dateTo: "2026-01-31" })
    expect(getMock).toHaveBeenCalledWith(
      "/reports/practitioners/p-1",
      expect.objectContaining({ dateFrom: "2026-01-01" }),
    )
  })

  it("exportRevenueCsv triggers a fetch to revenue export endpoint", () => {
    exportRevenueCsv("2026-01-01", "2026-01-31")
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/reports/revenue/export"),
      expect.anything(),
    )
  })

  it("exportBookingsCsv triggers a fetch to bookings export endpoint", () => {
    exportBookingsCsv("2026-01-01", "2026-01-31")
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/reports/bookings/export"),
      expect.anything(),
    )
  })

  it("exportPatientsCsv triggers a fetch to patients export endpoint", () => {
    exportPatientsCsv()
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/reports/patients/export"),
      expect.anything(),
    )
  })
})
