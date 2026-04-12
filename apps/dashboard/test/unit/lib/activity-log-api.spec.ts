import { beforeEach, describe, expect, it, vi } from "vitest"

const { getMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
}))

vi.mock("@/lib/api", () => ({
  api: { get: getMock },
}))

import { fetchActivityLogs } from "@/lib/api/activity-log"

describe("activity-log api", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("fetchActivityLogs calls /activity-log with query params", async () => {
    getMock.mockResolvedValueOnce({ items: [], meta: { total: 0 } })
    await fetchActivityLogs({ page: 1, perPage: 10, module: "bookings" })
    expect(getMock).toHaveBeenCalledWith("/activity-log", {
      page: 1,
      perPage: 10,
      sortBy: undefined,
      sortOrder: undefined,
      module: "bookings",
      action: undefined,
      userId: undefined,
      dateFrom: undefined,
      dateTo: undefined,
    })
  })

  it("fetchActivityLogs works with empty query", async () => {
    getMock.mockResolvedValueOnce({ items: [], meta: { total: 0 } })
    await fetchActivityLogs()
    expect(getMock).toHaveBeenCalledWith("/activity-log", {
      page: undefined,
      perPage: undefined,
      sortBy: undefined,
      sortOrder: undefined,
      module: undefined,
      action: undefined,
      userId: undefined,
      dateFrom: undefined,
      dateTo: undefined,
    })
  })

})
