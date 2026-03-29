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
  fetchAvailability,
  setAvailability,
  fetchBreaks,
  setBreaks,
  fetchSlots,
  fetchVacations,
  createVacation,
  deleteVacation,
  fetchPractitionerServices,
  assignService,
  updatePractitionerService,
  removePractitionerService,
  fetchPractitionerServiceTypes,
  fetchPractitionerRatings,
} from "@/lib/api/practitioners-schedule"

describe("practitioners-schedule api", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("fetchAvailability calls /practitioners/:id/availability", async () => {
    getMock.mockResolvedValueOnce({ schedule: [] })
    await fetchAvailability("p-1")
    expect(getMock).toHaveBeenCalledWith("/practitioners/p-1/availability")
  })

  it("setAvailability puts to /practitioners/:id/availability", async () => {
    putMock.mockResolvedValueOnce(undefined)
    await setAvailability("p-1", { schedule: [] } as Parameters<typeof setAvailability>[1])
    expect(putMock).toHaveBeenCalledWith("/practitioners/p-1/availability", expect.anything())
  })

  it("fetchBreaks calls /practitioners/:id/breaks", async () => {
    getMock.mockResolvedValueOnce([])
    await fetchBreaks("p-1")
    expect(getMock).toHaveBeenCalledWith("/practitioners/p-1/breaks")
  })

  it("setBreaks puts to /practitioners/:id/breaks", async () => {
    putMock.mockResolvedValueOnce([])
    await setBreaks("p-1", { breaks: [] } as Parameters<typeof setBreaks>[1])
    expect(putMock).toHaveBeenCalledWith("/practitioners/p-1/breaks", expect.anything())
  })

  it("fetchSlots calls /practitioners/:id/slots with params", async () => {
    getMock.mockResolvedValueOnce([])
    await fetchSlots("p-1", "2026-04-01", 30)
    expect(getMock).toHaveBeenCalledWith("/practitioners/p-1/slots", { date: "2026-04-01", duration: 30 })
  })

  it("fetchVacations calls /practitioners/:id/vacations", async () => {
    getMock.mockResolvedValueOnce([])
    await fetchVacations("p-1")
    expect(getMock).toHaveBeenCalledWith("/practitioners/p-1/vacations")
  })

  it("createVacation posts to /practitioners/:id/vacations", async () => {
    postMock.mockResolvedValueOnce({})
    await createVacation("p-1", { startDate: "2026-05-01", endDate: "2026-05-05" } as Parameters<typeof createVacation>[1])
    expect(postMock).toHaveBeenCalledWith("/practitioners/p-1/vacations", expect.anything())
  })

  it("deleteVacation calls /practitioners/:pId/vacations/:vId", async () => {
    deleteMock.mockResolvedValueOnce(undefined)
    await deleteVacation("p-1", "v-1")
    expect(deleteMock).toHaveBeenCalledWith("/practitioners/p-1/vacations/v-1")
  })

  it("fetchPractitionerServices calls /practitioners/:id/services", async () => {
    getMock.mockResolvedValueOnce([])
    await fetchPractitionerServices("p-1")
    expect(getMock).toHaveBeenCalledWith("/practitioners/p-1/services")
  })

  it("assignService posts to /practitioners/:id/services", async () => {
    postMock.mockResolvedValueOnce({})
    await assignService("p-1", { serviceId: "svc-1" } as Parameters<typeof assignService>[1])
    expect(postMock).toHaveBeenCalledWith("/practitioners/p-1/services", expect.anything())
  })

  it("updatePractitionerService patches /practitioners/:pId/services/:sId", async () => {
    patchMock.mockResolvedValueOnce({})
    await updatePractitionerService("p-1", "svc-1", { price: 100 } as Parameters<typeof updatePractitionerService>[2])
    expect(patchMock).toHaveBeenCalledWith("/practitioners/p-1/services/svc-1", expect.anything())
  })

  it("removePractitionerService deletes /practitioners/:pId/services/:sId", async () => {
    deleteMock.mockResolvedValueOnce(undefined)
    await removePractitionerService("p-1", "svc-1")
    expect(deleteMock).toHaveBeenCalledWith("/practitioners/p-1/services/svc-1")
  })

  it("fetchPractitionerServiceTypes calls /practitioners/:pId/services/:sId/types", async () => {
    getMock.mockResolvedValueOnce([])
    await fetchPractitionerServiceTypes("p-1", "svc-1")
    expect(getMock).toHaveBeenCalledWith("/practitioners/p-1/services/svc-1/types")
  })

  it("fetchPractitionerRatings calls /practitioners/:id/ratings", async () => {
    getMock.mockResolvedValueOnce({ items: [], meta: {} })
    await fetchPractitionerRatings("p-1", { page: 1 })
    expect(getMock).toHaveBeenCalledWith("/practitioners/p-1/ratings", expect.anything())
  })
})
