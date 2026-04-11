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
      expect(result.items[0]._count!.ratings).toBe(12)
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

      expect(result.items[0]!._count!.bookings).toBe(0)
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
      expect(result._count!.ratings).toBe(8)
    })
  })

  describe("createPractitioner", () => {
    it("posts to /practitioners with payload", async () => {
      postMock.mockResolvedValueOnce({ id: "p-2" })

      await createPractitioner({
        userId: "u-1",
        specialty: "General",
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

  describe("mapPractitioner edge cases", () => {
    it("maps specialty object to nameEn string", async () => {
      getMock.mockResolvedValueOnce({
        items: [{ id: "p-1", specialty: { id: "sp-1", nameEn: "Cardiology", nameAr: "قلب" } }],
        meta: { total: 1 },
      })

      const result = await fetchPractitioners()

      expect(result.items[0].specialty).toBe("Cardiology")
    })

    it("maps specialty object and sets specialtyAr", async () => {
      getMock.mockResolvedValueOnce({
        items: [{ id: "p-1", specialty: { id: "sp-1", nameEn: "Cardiology", nameAr: "أمراض القلب" } }],
        meta: { total: 1 },
      })

      const result = await fetchPractitioners()

      expect(result.items[0].specialtyAr).toBe("أمراض القلب")
    })

    it("preserves specialty as-is when it is already a string", async () => {
      getMock.mockResolvedValueOnce({
        items: [{ id: "p-1", specialty: "Orthopedics" }],
        meta: { total: 1 },
      })

      const result = await fetchPractitioners()

      expect(result.items[0].specialty).toBe("Orthopedics")
    })

    it("sets specialty to empty string when null", async () => {
      getMock.mockResolvedValueOnce({
        items: [{ id: "p-1", specialty: null }],
        meta: { total: 1 },
      })

      const result = await fetchPractitioners()

      expect(result.items[0].specialty).toBe("")
    })

    it("uses specialtyAr from raw when specialty is string", async () => {
      getMock.mockResolvedValueOnce({
        items: [{ id: "p-1", specialty: "Orthopedics", specialtyAr: "عظام" }],
        meta: { total: 1 },
      })

      const result = await fetchPractitioners()

      expect(result.items[0].specialtyAr).toBe("عظام")
    })

    it("sets specialtyAr to null when specialty is null", async () => {
      getMock.mockResolvedValueOnce({
        items: [{ id: "p-1", specialty: null }],
        meta: { total: 1 },
      })

      const result = await fetchPractitioners()

      expect(result.items[0].specialtyAr).toBeNull()
    })

    it("sets specialtyAr to null when specialty is string and specialtyAr is missing", async () => {
      getMock.mockResolvedValueOnce({
        items: [{ id: "p-1", specialty: "General" }],
        meta: { total: 1 },
      })

      const result = await fetchPractitioners()

      expect(result.items[0].specialtyAr).toBeNull()
    })

    it("extracts avatarUrl from user object", async () => {
      getMock.mockResolvedValueOnce({
        items: [{ id: "p-1", user: { avatarUrl: "https://img.url/pic.jpg" } }],
        meta: { total: 1 },
      })

      const result = await fetchPractitioners()

      expect(result.items[0].avatarUrl).toBe("https://img.url/pic.jpg")
    })

    it("falls back to raw avatarUrl when user.avatarUrl is null", async () => {
      getMock.mockResolvedValueOnce({
        items: [{ id: "p-1", user: { avatarUrl: null }, avatarUrl: "fallback.jpg" }],
        meta: { total: 1 },
      })

      const result = await fetchPractitioners()

      expect(result.items[0].avatarUrl).toBe("fallback.jpg")
    })

    it("sets avatarUrl to null when both user.avatarUrl and raw.avatarUrl are missing", async () => {
      getMock.mockResolvedValueOnce({
        items: [{ id: "p-1", user: {} }],
        meta: { total: 1 },
      })

      const result = await fetchPractitioners()

      expect(result.items[0].avatarUrl).toBeNull()
    })

    it("sets averageRating to undefined when neither averageRating nor rating exist", async () => {
      getMock.mockResolvedValueOnce({
        items: [{ id: "p-1", _count: { bookings: 0, ratings: 0 } }],
        meta: { total: 1 },
      })

      const result = await fetchPractitioners()

      expect(result.items[0].averageRating).toBeUndefined()
    })

    it("defaults _count to {bookings:0, ratings:0} when _count and reviewCount both missing", async () => {
      getMock.mockResolvedValueOnce({
        items: [{ id: "p-1" }],
        meta: { total: 1 },
      })

      const result = await fetchPractitioners()

      expect(result.items[0]._count).toEqual({ bookings: 0, ratings: 0 })
    })

    it("uses reviewCount as ratings count in default _count", async () => {
      getMock.mockResolvedValueOnce({
        items: [{ id: "p-1", reviewCount: 7 }],
        meta: { total: 1 },
      })

      const result = await fetchPractitioners()

      expect(result.items[0]!._count!.ratings).toBe(7)
      expect(result.items[0]!._count!.bookings).toBe(0)
    })
  })
})
