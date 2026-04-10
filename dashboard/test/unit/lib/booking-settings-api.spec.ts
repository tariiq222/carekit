import { beforeEach, describe, expect, it, vi } from "vitest"

const { getMock, patchMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  patchMock: vi.fn(),
}))

vi.mock("@/lib/api", () => ({
  api: { get: getMock, patch: patchMock },
}))

import { fetchBookingSettings, updateBookingSettings } from "@/lib/api/booking-settings"

describe("booking-settings api", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("fetchBookingSettings calls /booking-settings", async () => {
    const mockSettings = { id: "bs-1", paymentTimeoutMinutes: 30 }
    getMock.mockResolvedValueOnce(mockSettings)
    const result = await fetchBookingSettings()
    expect(getMock).toHaveBeenCalledWith("/booking-settings")
    expect(result).toEqual(mockSettings)
  })

  it("updateBookingSettings patches /booking-settings", async () => {
    const updated = { id: "bs-1", paymentTimeoutMinutes: 60 }
    patchMock.mockResolvedValueOnce(updated)
    const result = await updateBookingSettings({ paymentTimeoutMinutes: 60 })
    expect(patchMock).toHaveBeenCalledWith("/booking-settings", { paymentTimeoutMinutes: 60 })
    expect(result).toEqual(updated)
  })
})
