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
    expect(getMock).toHaveBeenCalledWith("/organization/hours")
  })

  it("updateOrganizationHours puts to /organization/hours", async () => {
    putMock.mockResolvedValueOnce([])
    await updateOrganizationHours([])
    expect(putMock).toHaveBeenCalledWith("/organization/hours", { hours: [] })
  })

  it("fetchOrganizationHolidays calls /organization/holidays without params", async () => {
    getMock.mockResolvedValueOnce([])
    await fetchOrganizationHolidays()
    expect(getMock).toHaveBeenCalledWith("/organization/holidays", undefined)
  })

  it("fetchOrganizationHolidays passes year param", async () => {
    getMock.mockResolvedValueOnce([])
    await fetchOrganizationHolidays(2026)
    expect(getMock).toHaveBeenCalledWith("/organization/holidays", { year: 2026 })
  })

  it("createOrganizationHoliday posts to /organization/holidays", async () => {
    postMock.mockResolvedValueOnce({})
    await createOrganizationHoliday({ date: "2026-12-25", nameAr: "عيد", nameEn: "Holiday" })
    expect(postMock).toHaveBeenCalledWith("/organization/holidays", expect.objectContaining({ date: "2026-12-25" }))
  })

  it("deleteOrganizationHoliday deletes /organization/holidays/:id", async () => {
    deleteMock.mockResolvedValueOnce(undefined)
    await deleteOrganizationHoliday("h-1")
    expect(deleteMock).toHaveBeenCalledWith("/organization/holidays/h-1")
  })
})

describe("booking-settings api", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("fetchBookingSettings calls /booking-settings", async () => {
    getMock.mockResolvedValueOnce({})
    await fetchBookingSettings()
    expect(getMock).toHaveBeenCalledWith("/booking-settings")
  })

  it("updateBookingSettings patches /booking-settings", async () => {
    patchMock.mockResolvedValueOnce({})
    await updateBookingSettings({ bufferMinutes: 10 })
    expect(patchMock).toHaveBeenCalledWith("/booking-settings", { bufferMinutes: 10 })
  })
})
