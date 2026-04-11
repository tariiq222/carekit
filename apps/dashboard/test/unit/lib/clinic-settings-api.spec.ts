import { beforeEach, describe, expect, it, vi } from "vitest"

const { getMock, putMock, patchMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  putMock: vi.fn(),
  patchMock: vi.fn(),
}))

vi.mock("@/lib/api", () => ({
  api: { get: getMock, put: putMock, patch: patchMock },
}))

import {
  fetchClinicSettings,
  fetchClinicSettingsPublic,
  updateClinicSettings,
  fetchBookingFlowOrder,
  updateBookingFlowOrder,
  fetchPaymentSettings,
  updatePaymentSettings,
} from "@/lib/api/clinic-settings"

describe("clinic-settings api", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("fetchClinicSettings calls /clinic-settings", async () => {
    getMock.mockResolvedValueOnce({ id: "cs-1", clinicName: "Test" })
    await fetchClinicSettings()
    expect(getMock).toHaveBeenCalledWith("/clinic-settings")
  })

  it("fetchClinicSettingsPublic calls /clinic-settings/public", async () => {
    getMock.mockResolvedValueOnce({ clinicName: "Public" })
    await fetchClinicSettingsPublic()
    expect(getMock).toHaveBeenCalledWith("/clinic-settings/public")
  })

  it("updateClinicSettings puts to /clinic-settings", async () => {
    putMock.mockResolvedValueOnce({ id: "cs-1" })
    await updateClinicSettings({ clinicName: "Updated" } as Parameters<typeof updateClinicSettings>[0])
    expect(putMock).toHaveBeenCalledWith("/clinic-settings", expect.anything())
  })

  it("fetchBookingFlowOrder calls /clinic/settings/booking-flow", async () => {
    getMock.mockResolvedValueOnce({ bookingFlowOrder: "service_first" })
    const result = await fetchBookingFlowOrder()
    expect(getMock).toHaveBeenCalledWith("/clinic/settings/booking-flow")
    expect(result).toBe("service_first")
  })

  it("updateBookingFlowOrder patches /clinic/settings/booking-flow", async () => {
    patchMock.mockResolvedValueOnce({ bookingFlowOrder: "employee_first" })
    const result = await updateBookingFlowOrder("employee_first")
    expect(patchMock).toHaveBeenCalledWith("/clinic/settings/booking-flow", { order: "employee_first" })
    expect(result).toBe("employee_first")
  })

  it("fetchPaymentSettings calls /clinic/settings/payment", async () => {
    getMock.mockResolvedValueOnce({ paymentMoyasarEnabled: true })
    await fetchPaymentSettings()
    expect(getMock).toHaveBeenCalledWith("/clinic/settings/payment")
  })

  it("updatePaymentSettings patches /clinic/settings/payment", async () => {
    patchMock.mockResolvedValueOnce({ paymentMoyasarEnabled: false })
    await updatePaymentSettings({ paymentMoyasarEnabled: false })
    expect(patchMock).toHaveBeenCalledWith("/clinic/settings/payment", { paymentMoyasarEnabled: false })
  })
})
