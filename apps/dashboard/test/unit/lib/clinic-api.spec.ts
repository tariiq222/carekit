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
  fetchClinicHours,
  updateClinicHours,
  fetchClinicHolidays,
  createClinicHoliday,
  deleteClinicHoliday,
} from "@/lib/api/clinic"

import {
  fetchBookingSettings,
  updateBookingSettings,
} from "@/lib/api/booking-settings"

describe("clinic api", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("fetchClinicHours calls /clinic/hours", async () => {
    getMock.mockResolvedValueOnce([])
    await fetchClinicHours()
    expect(getMock).toHaveBeenCalledWith("/clinic/hours")
  })

  it("updateClinicHours puts to /clinic/hours", async () => {
    putMock.mockResolvedValueOnce([])
    await updateClinicHours([])
    expect(putMock).toHaveBeenCalledWith("/clinic/hours", { hours: [] })
  })

  it("fetchClinicHolidays calls /clinic/holidays without params", async () => {
    getMock.mockResolvedValueOnce([])
    await fetchClinicHolidays()
    expect(getMock).toHaveBeenCalledWith("/clinic/holidays", undefined)
  })

  it("fetchClinicHolidays passes year param", async () => {
    getMock.mockResolvedValueOnce([])
    await fetchClinicHolidays(2026)
    expect(getMock).toHaveBeenCalledWith("/clinic/holidays", { year: 2026 })
  })

  it("createClinicHoliday posts to /clinic/holidays", async () => {
    postMock.mockResolvedValueOnce({})
    await createClinicHoliday({ date: "2026-12-25", nameAr: "عيد", nameEn: "Holiday" })
    expect(postMock).toHaveBeenCalledWith("/clinic/holidays", expect.objectContaining({ date: "2026-12-25" }))
  })

  it("deleteClinicHoliday deletes /clinic/holidays/:id", async () => {
    deleteMock.mockResolvedValueOnce(undefined)
    await deleteClinicHoliday("h-1")
    expect(deleteMock).toHaveBeenCalledWith("/clinic/holidays/h-1")
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
