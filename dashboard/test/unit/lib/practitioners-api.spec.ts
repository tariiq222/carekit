import { beforeEach, describe, expect, it, vi } from "vitest"

const { getMock, postMock, patchMock, deleteMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn(),
  patchMock: vi.fn(),
  deleteMock: vi.fn(),
}))

vi.mock("@/lib/api", () => ({
  api: { get: getMock, post: postMock, patch: patchMock, delete: deleteMock },
}))

import {
  fetchPractitioners,
  fetchPractitioner,
  createPractitioner,
  onboardPractitioner,
  updatePractitioner,
  deletePractitioner,
} from "@/lib/api/practitioners"

describe("practitioners api", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("fetchPractitioners", () => {
    it("sends all query params to /practitioners", async () => {
      getMock.mockResolvedValueOnce({
        items: [],
        meta: { total: 0, page: 1, perPage: 20 },
      })

      await fetchPractitioners({
        page: 2,
        perPage: 15,
        search: "سارة",
        specialty: "cardiology",
        isActive: true,
        minRating: 4,
        sortBy: "name",
        sortOrder: "asc",
      })

      expect(getMock).toHaveBeenCalledWith("/practitioners", {
        page: 2,
        perPage: 15,
        search: "سارة",
        specialty: "cardiology",
        isActive: true,
        minRating: 4,
        sortBy: "name",
        sortOrder: "asc",
      })
    })

    it("defaults to empty query object", async () => {
      getMock.mockResolvedValueOnce({ items: [], meta: { total: 0 } })
      await fetchPractitioners()
      expect(getMock).toHaveBeenCalledWith("/practitioners", expect.any(Object))
    })

    it("maps backend rating field to averageRating", async () => {
      getMock.mockResolvedValueOnce({
        items: [{ id: "p-1", rating: 4.5, reviewCount: 12 }],
        meta: { total: 1 },
      })

      const result = await fetchPractitioners()

      expect(result.items[0].averageRating).toBe(4.5)
      expect(result.items[0]._count.ratings).toBe(12)
    })

    it("prefers averageRating over rating when both present", async () => {
      getMock.mockResolvedValueOnce({
        items: [{ id: "p-1", averageRating: 3.8, rating: 4.5, reviewCount: 5 }],
        meta: { total: 1 },
      })

      const result = await fetchPractitioners()

      expect(result.items[0].averageRating).toBe(3.8)
    })

    it("defaults _count.bookings to 0 when not returned by backend", async () => {
      getMock.mockResolvedValueOnce({
        items: [{ id: "p-1", rating: 4.0, reviewCount: 3 }],
        meta: { total: 1 },
      })

      const result = await fetchPractitioners()

      expect(result.items[0]._count.bookings).toBe(0)
    })

    it("passes through existing _count from backend", async () => {
      getMock.mockResolvedValueOnce({
        items: [{ id: "p-1", _count: { bookings: 10, ratings: 6 } }],
        meta: { total: 1 },
      })

      const result = await fetchPractitioners()

      expect(result.items[0]._count).toEqual({ bookings: 10, ratings: 6 })
    })
  })

  describe("fetchPractitioner", () => {
    it("calls /practitioners/:id", async () => {
      getMock.mockResolvedValueOnce({ id: "p-1", rating: 4.2, reviewCount: 8 })

      await fetchPractitioner("p-1")

      expect(getMock).toHaveBeenCalledWith("/practitioners/p-1")
    })

    it("maps backend shape before returning", async () => {
      getMock.mockResolvedValueOnce({ id: "p-1", rating: 4.2, reviewCount: 8 })

      const result = await fetchPractitioner("p-1")

      expect(result.averageRating).toBe(4.2)
      expect(result._count.ratings).toBe(8)
    })
  })

  describe("createPractitioner", () => {
    it("posts to /practitioners with payload", async () => {
      postMock.mockResolvedValueOnce({ id: "p-2" })

      await createPractitioner({
        firstName: "فاطمة",
        lastName: "الزهراني",
        email: "fatima@clinic.com",
      } as Parameters<typeof createPractitioner>[0])

      expect(postMock).toHaveBeenCalledWith(
        "/practitioners",
        expect.objectContaining({ firstName: "فاطمة" }),
      )
    })
  })

  describe("onboardPractitioner", () => {
    it("posts to /practitioners/onboard", async () => {
      postMock.mockResolvedValueOnce({ practitionerId: "p-3", inviteUrl: "https://..." })

      await onboardPractitioner({
        email: "new@clinic.com",
      } as Parameters<typeof onboardPractitioner>[0])

      expect(postMock).toHaveBeenCalledWith(
        "/practitioners/onboard",
        expect.objectContaining({ email: "new@clinic.com" }),
      )
    })
  })

  describe("updatePractitioner", () => {
    it("patches /practitioners/:id with payload", async () => {
      patchMock.mockResolvedValueOnce({ id: "p-1" })

      await updatePractitioner("p-1", { bio: "متخصص في أمراض القلب" })

      expect(patchMock).toHaveBeenCalledWith(
        "/practitioners/p-1",
        { bio: "متخصص في أمراض القلب" },
      )
    })
  })

  describe("deletePractitioner", () => {
    it("calls DELETE /practitioners/:id", async () => {
      deleteMock.mockResolvedValueOnce(undefined)

      await deletePractitioner("p-1")

      expect(deleteMock).toHaveBeenCalledWith("/practitioners/p-1")
    })
  })
})
