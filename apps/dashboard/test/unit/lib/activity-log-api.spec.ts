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
    expect(getMock).toHaveBeenCalledWith("/dashboard/ops/activity", {
      page: 1,
      limit: 10,
      sortBy: undefined,
      sortOrder: undefined,
      module: "bookings",
      action: undefined,
      userId: undefined,
      fromDate: undefined,
      toDate: undefined,
    })
  })

  it("fetchActivityLogs works with empty query", async () => {
    getMock.mockResolvedValueOnce({ items: [], meta: { total: 0 } })
    await fetchActivityLogs()
    expect(getMock).toHaveBeenCalledWith("/dashboard/ops/activity", {
      page: undefined,
      limit: undefined,
      sortBy: undefined,
      sortOrder: undefined,
      module: undefined,
      action: undefined,
      userId: undefined,
      fromDate: undefined,
      toDate: undefined,
    })
  })

})
