import { beforeEach, describe, expect, it, vi } from "vitest"

const { getMock, deleteMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  deleteMock: vi.fn(),
}))

vi.mock("@/lib/api", () => ({
  api: { get: getMock, delete: deleteMock },
}))

import { fetchWaitlist, removeWaitlistEntry } from "@/lib/api/waitlist"

describe("waitlist api", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("fetchWaitlist calls GET /bookings/waitlist with query", async () => {
    getMock.mockResolvedValueOnce([{ id: "1", status: "waiting" }])
    await fetchWaitlist({ practitionerId: "p1", status: "waiting" })
    expect(getMock).toHaveBeenCalledWith("/bookings/waitlist", { practitionerId: "p1", status: "waiting" })
  })

  it("fetchWaitlist works without query", async () => {
    getMock.mockResolvedValueOnce([])
    await fetchWaitlist()
    expect(getMock).toHaveBeenCalledWith("/bookings/waitlist", undefined)
  })

  it("removeWaitlistEntry calls DELETE /bookings/waitlist/:id", async () => {
    deleteMock.mockResolvedValueOnce(undefined)
    await removeWaitlistEntry("1")
    expect(deleteMock).toHaveBeenCalledWith("/bookings/waitlist/1")
  })
})
