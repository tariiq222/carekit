import { beforeEach, describe, expect, it, vi } from "vitest"

const { apiMock } = vi.hoisted(() => ({
  apiMock: {
    post: vi.fn(),
  },
}))

vi.mock("@/lib/api", () => ({
  api: apiMock,
}))

import { billingApi } from "@/lib/api/billing"

describe("billingApi scheduled cancellation", () => {
  beforeEach(() => vi.clearAllMocks())

  it("schedules cancellation at period end", async () => {
    apiMock.post.mockResolvedValueOnce({ id: "sub-1", cancelAtPeriodEnd: true })

    await billingApi.scheduleCancel("budget")

    expect(apiMock.post).toHaveBeenCalledWith(
      "/dashboard/billing/subscription/schedule-cancel",
      { reason: "budget" },
    )
  })

  it("reactivates a scheduled cancellation", async () => {
    apiMock.post.mockResolvedValueOnce({ id: "sub-1", cancelAtPeriodEnd: false })

    await billingApi.reactivate()

    expect(apiMock.post).toHaveBeenCalledWith(
      "/dashboard/billing/subscription/reactivate",
      {},
    )
  })
})
