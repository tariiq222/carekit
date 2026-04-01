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
  fetchCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  fetchServices,
  fetchService,
  createService,
  updateService,
  deleteService,
  fetchDurationOptions,
  setDurationOptions,
  fetchServiceBookingTypes,
  setServiceBookingTypes,
  fetchIntakeForms,
  createIntakeForm,
  updateIntakeForm,
  deleteIntakeForm,
  setIntakeFields,
  fetchIntakeResponses,
} from "@/lib/api/services"

describe("services api", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("fetchCategories calls /services/categories", async () => {
    getMock.mockResolvedValueOnce([])
    await fetchCategories()
    expect(getMock).toHaveBeenCalledWith("/services/categories")
  })

  it("createCategory posts to /services/categories", async () => {
    postMock.mockResolvedValueOnce({ id: "cat-1" })
    await createCategory({ nameEn: "Physio", nameAr: "علاج" })
    expect(postMock).toHaveBeenCalledWith("/services/categories", expect.objectContaining({ nameEn: "Physio" }))
  })

  it("updateCategory patches /services/categories/:id", async () => {
    patchMock.mockResolvedValueOnce({ id: "cat-1" })
    await updateCategory("cat-1", { nameEn: "Physio" })
    expect(patchMock).toHaveBeenCalledWith("/services/categories/cat-1", expect.anything())
  })

  it("deleteCategory calls DELETE /services/categories/:id", async () => {
    deleteMock.mockResolvedValueOnce(undefined)
    await deleteCategory("cat-1")
    expect(deleteMock).toHaveBeenCalledWith("/services/categories/cat-1")
  })

  it("fetchServices sends query params to /services", async () => {
    getMock.mockResolvedValueOnce({ items: [], meta: { total: 0 } })
    await fetchServices({ isActive: true })
    expect(getMock).toHaveBeenCalledWith("/services", expect.objectContaining({ isActive: true }))
  })

  it("fetchService calls /services/:id", async () => {
    getMock.mockResolvedValueOnce({ id: "svc-1" })
    await fetchService("svc-1")
    expect(getMock).toHaveBeenCalledWith("/services/svc-1")
  })

  it("createService posts to /services", async () => {
    postMock.mockResolvedValueOnce({ id: "svc-1" })
    await createService({ nameEn: "Service" } as Parameters<typeof createService>[0])
    expect(postMock).toHaveBeenCalledWith("/services", expect.anything())
  })

  it("updateService patches /services/:id", async () => {
    patchMock.mockResolvedValueOnce({ id: "svc-1" })
    await updateService("svc-1", { nameEn: "Updated" })
    expect(patchMock).toHaveBeenCalledWith("/services/svc-1", expect.anything())
  })

  it("deleteService calls DELETE /services/:id", async () => {
    deleteMock.mockResolvedValueOnce(undefined)
    await deleteService("svc-1")
    expect(deleteMock).toHaveBeenCalledWith("/services/svc-1")
  })

  it("fetchDurationOptions calls /services/:id/duration-options", async () => {
    getMock.mockResolvedValueOnce([])
    await fetchDurationOptions("svc-1")
    expect(getMock).toHaveBeenCalledWith("/services/svc-1/duration-options")
  })

  it("setDurationOptions puts to /services/:id/duration-options", async () => {
    putMock.mockResolvedValueOnce([])
    await setDurationOptions("svc-1", { options: [] } as Parameters<typeof setDurationOptions>[1])
    expect(putMock).toHaveBeenCalledWith("/services/svc-1/duration-options", expect.anything())
  })

  it("fetchServiceBookingTypes calls /services/:id/booking-types", async () => {
    getMock.mockResolvedValueOnce([])
    await fetchServiceBookingTypes("svc-1")
    expect(getMock).toHaveBeenCalledWith("/services/svc-1/booking-types")
  })

  it("setServiceBookingTypes puts to /services/:id/booking-types", async () => {
    putMock.mockResolvedValueOnce([])
    await setServiceBookingTypes("svc-1", { types: [] } as Parameters<typeof setServiceBookingTypes>[1])
    expect(putMock).toHaveBeenCalledWith("/services/svc-1/booking-types", expect.anything())
  })

  it("fetchIntakeForms calls /services/:id/intake-forms/all", async () => {
    getMock.mockResolvedValueOnce([])
    await fetchIntakeForms("svc-1")
    expect(getMock).toHaveBeenCalledWith("/services/svc-1/intake-forms/all")
  })

  it("createIntakeForm posts to /services/:id/intake-forms", async () => {
    postMock.mockResolvedValueOnce({ id: "form-1" })
    await createIntakeForm("svc-1", { titleAr: "نموذج", titleEn: "Form" } as Parameters<typeof createIntakeForm>[1])
    expect(postMock).toHaveBeenCalledWith("/services/svc-1/intake-forms", expect.anything())
  })

  it("updateIntakeForm patches /intake-forms/:id", async () => {
    patchMock.mockResolvedValueOnce({ id: "form-1" })
    await updateIntakeForm("form-1", { titleAr: "محدث" })
    expect(patchMock).toHaveBeenCalledWith("/intake-forms/form-1", expect.anything())
  })

  it("deleteIntakeForm calls DELETE /intake-forms/:id", async () => {
    deleteMock.mockResolvedValueOnce(undefined)
    await deleteIntakeForm("form-1")
    expect(deleteMock).toHaveBeenCalledWith("/intake-forms/form-1")
  })

  it("setIntakeFields puts to /intake-forms/:id/fields", async () => {
    putMock.mockResolvedValueOnce({})
    await setIntakeFields("form-1", { fields: [] } as Parameters<typeof setIntakeFields>[1])
    expect(putMock).toHaveBeenCalledWith("/intake-forms/form-1/fields", expect.anything())
  })

  it("fetchIntakeResponses calls /intake-forms/responses/:bookingId", async () => {
    getMock.mockResolvedValueOnce([])
    await fetchIntakeResponses("bk-1")
    expect(getMock).toHaveBeenCalledWith("/intake-forms/responses/bk-1")
  })
})
