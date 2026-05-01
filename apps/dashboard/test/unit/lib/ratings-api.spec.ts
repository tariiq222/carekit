import { beforeEach, describe, expect, it, vi } from "vitest"

const { getMock, postMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn(),
}))

vi.mock("@/lib/api", () => ({
  api: { get: getMock, post: postMock },
}))

import { fetchRatings, submitRating } from "@/lib/api/ratings"

describe("ratings api", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("fetches ratings from the dashboard organization endpoint", async () => {
    getMock.mockResolvedValueOnce({ items: [], meta: { total: 0 } })

    await fetchRatings({ page: 2, limit: 10, employeeId: "emp-1" })

    expect(getMock).toHaveBeenCalledWith("/dashboard/organization/ratings", {
      page: 2,
      limit: 10,
      employeeId: "emp-1",
      clientId: undefined,
    })
  })

  it("submits ratings to the dashboard organization endpoint", async () => {
    postMock.mockResolvedValueOnce({ id: "rating-1" })

    await submitRating({
      bookingId: "booking-1",
      clientId: "client-1",
      employeeId: "emp-1",
      score: 5,
    })

    expect(postMock).toHaveBeenCalledWith("/dashboard/organization/ratings", {
      bookingId: "booking-1",
      clientId: "client-1",
      employeeId: "emp-1",
      score: 5,
    })
  })
})
