import { beforeEach, describe, expect, it, vi } from "vitest"

const { getMock, postMock, patchMock, deleteMock, putMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn(),
  patchMock: vi.fn(),
  deleteMock: vi.fn(),
  putMock: vi.fn(),
}))

const setAccessTokenMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/api", () => ({
  api: { get: getMock, post: postMock, patch: patchMock, delete: deleteMock, put: putMock },
  setAccessToken: setAccessTokenMock,
}))

import {
  fetchWidgetBranding,
  fetchWidgetPractitioners,
  fetchWidgetPractitioner,
  fetchWidgetPractitionerServices,
  fetchWidgetServiceTypes,
  fetchWidgetSlots,
  fetchWidgetServices,
  fetchWidgetServiceBookingTypes,
  widgetRegister,
  widgetSendOtp,
  widgetVerifyOtp,
  widgetLogin,
  widgetCreateBooking,
} from "@/lib/api/widget"

describe("widget api", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("fetchWidgetBranding calls /whitelabel/public", async () => {
    getMock.mockResolvedValueOnce({})
    await fetchWidgetBranding()
    expect(getMock).toHaveBeenCalledWith("/whitelabel/public")
  })

  it("fetchWidgetPractitioners calls /practitioners", async () => {
    getMock.mockResolvedValueOnce({ items: [], meta: {} })
    await fetchWidgetPractitioners()
    expect(getMock).toHaveBeenCalledWith("/practitioners", expect.objectContaining({ isActive: true }))
  })

  it("fetchWidgetPractitioner calls /practitioners/:id", async () => {
    getMock.mockResolvedValueOnce({ id: "p-1" })
    await fetchWidgetPractitioner("p-1")
    expect(getMock).toHaveBeenCalledWith("/practitioners/p-1")
  })

  it("fetchWidgetPractitionerServices calls /practitioners/:id/services", async () => {
    getMock.mockResolvedValueOnce([])
    await fetchWidgetPractitionerServices("p-1")
    expect(getMock).toHaveBeenCalledWith("/practitioners/p-1/services")
  })

  it("fetchWidgetServiceTypes calls /practitioners/:pId/services/:sId/types", async () => {
    getMock.mockResolvedValueOnce([])
    await fetchWidgetServiceTypes("p-1", "svc-1")
    expect(getMock).toHaveBeenCalledWith("/practitioners/p-1/services/svc-1/types")
  })

  it("fetchWidgetSlots calls /practitioners/:id/slots", async () => {
    getMock.mockResolvedValueOnce([])
    await fetchWidgetSlots("p-1", "2026-04-01")
    expect(getMock).toHaveBeenCalledWith("/practitioners/p-1/slots", expect.objectContaining({ date: "2026-04-01" }))
  })

  it("fetchWidgetServices calls /services", async () => {
    getMock.mockResolvedValueOnce({ items: [], meta: {} })
    await fetchWidgetServices()
    expect(getMock).toHaveBeenCalledWith("/services", expect.objectContaining({ isActive: true }))
  })

  it("fetchWidgetServiceBookingTypes calls /services/:id/booking-types", async () => {
    getMock.mockResolvedValueOnce([])
    await fetchWidgetServiceBookingTypes("svc-1")
    expect(getMock).toHaveBeenCalledWith("/services/svc-1/booking-types")
  })

  it("widgetRegister posts to /auth/register and stores token", async () => {
    postMock.mockResolvedValueOnce({ user: {}, accessToken: "tok", expiresIn: 3600 })
    await widgetRegister({ firstName: "A", lastName: "B", email: "a@b.com", phone: "1", password: "pw" })
    expect(postMock).toHaveBeenCalledWith("/auth/register", expect.anything())
    expect(setAccessTokenMock).toHaveBeenCalledWith("tok")
  })

  it("widgetSendOtp posts to /auth/login/otp/send", async () => {
    postMock.mockResolvedValueOnce({ message: "ok" })
    await widgetSendOtp("a@b.com", "pw")
    expect(postMock).toHaveBeenCalledWith("/auth/login/otp/send", { email: "a@b.com", password: "pw" })
  })

  it("widgetVerifyOtp posts to /auth/login/otp/verify and stores token", async () => {
    postMock.mockResolvedValueOnce({ user: {}, accessToken: "tok2", expiresIn: 3600 })
    await widgetVerifyOtp("a@b.com", "123456")
    expect(postMock).toHaveBeenCalledWith("/auth/login/otp/verify", { email: "a@b.com", code: "123456" })
    expect(setAccessTokenMock).toHaveBeenCalledWith("tok2")
  })

  it("widgetLogin posts to /auth/login and stores token", async () => {
    postMock.mockResolvedValueOnce({ user: {}, accessToken: "tok3", expiresIn: 3600 })
    await widgetLogin("a@b.com", "pw")
    expect(postMock).toHaveBeenCalledWith("/auth/login", { email: "a@b.com", password: "pw" })
    expect(setAccessTokenMock).toHaveBeenCalledWith("tok3")
  })

  it("widgetCreateBooking posts to /bookings", async () => {
    postMock.mockResolvedValueOnce({ id: "bk-1" })
    await widgetCreateBooking({ serviceId: "svc-1" } as Parameters<typeof widgetCreateBooking>[0])
    expect(postMock).toHaveBeenCalledWith("/bookings", expect.anything())
  })
})
