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
}))

import {
  fetchOrganizationHours,
  updateOrganizationHours,
  fetchOrganizationHolidays,
  createOrganizationHoliday,
  deleteOrganizationHoliday,
} from "@/lib/api/organization"

import {
  fetchBookingSettings,
  updateBookingSettings,
} from "@/lib/api/booking-settings"

describe("organization api", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("fetchOrganizationHours calls /organization/hours", async () => {
    getMock.mockResolvedValueOnce([])
    await fetchOrganizationHours()
    expect(getMock).toHaveBeenCalledWith("/dashboard/organization/hours")
  })

  it("updateOrganizationHours posts to /organization/hours", async () => {
    postMock.mockResolvedValueOnce([])
    await updateOrganizationHours([])
    expect(postMock).toHaveBeenCalledWith("/dashboard/organization/hours", { hours: [] })
  })

  it("fetchOrganizationHolidays calls /organization/holidays without params", async () => {
    getMock.mockResolvedValueOnce([])
    await fetchOrganizationHolidays()
    expect(getMock).toHaveBeenCalledWith("/dashboard/organization/holidays", undefined)
  })

  it("fetchOrganizationHolidays passes year param", async () => {
    getMock.mockResolvedValueOnce([])
    await fetchOrganizationHolidays(2026)
    expect(getMock).toHaveBeenCalledWith("/dashboard/organization/holidays", { year: 2026 })
  })

  it("createOrganizationHoliday posts to /organization/holidays", async () => {
    postMock.mockResolvedValueOnce({})
    await createOrganizationHoliday({ date: "2026-12-25", nameAr: "عيد", nameEn: "Holiday" })
    expect(postMock).toHaveBeenCalledWith("/dashboard/organization/holidays", expect.objectContaining({ date: "2026-12-25" }))
  })

  it("deleteOrganizationHoliday deletes /organization/holidays/:id", async () => {
    deleteMock.mockResolvedValueOnce(undefined)
    await deleteOrganizationHoliday("h-1")
    expect(deleteMock).toHaveBeenCalledWith("/dashboard/organization/holidays/h-1")
  })
})

describe("booking-settings api", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("fetchBookingSettings calls /booking-settings", async () => {
    getMock.mockResolvedValueOnce({})
    await fetchBookingSettings()
    expect(getMock).toHaveBeenCalledWith("/dashboard/organization/booking-settings")
  })

  it("updateBookingSettings patches /booking-settings", async () => {
    patchMock.mockResolvedValueOnce({})
    await updateBookingSettings({ bufferMinutes: 10 })
    expect(patchMock).toHaveBeenCalledWith("/dashboard/organization/booking-settings", { bufferMinutes: 10 })
  })
})
