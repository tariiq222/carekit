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
  fetchOrganizationSettings,
  fetchOrganizationSettingsPublic,
  updateOrganizationSettings,
  fetchBookingFlowOrder,
  updateBookingFlowOrder,
  fetchPaymentSettings,
  updatePaymentSettings,
} from "@/lib/api/organization-settings"

describe("organization-settings api", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("fetchOrganizationSettings calls /organization-settings", async () => {
    getMock.mockResolvedValueOnce({ id: "cs-1", organizationName: "Test" })
    await fetchOrganizationSettings()
    expect(getMock).toHaveBeenCalledWith("/organization-settings")
  })

  it("fetchOrganizationSettingsPublic calls /organization-settings/public", async () => {
    getMock.mockResolvedValueOnce({ organizationName: "Public" })
    await fetchOrganizationSettingsPublic()
    expect(getMock).toHaveBeenCalledWith("/organization-settings/public")
  })

  it("updateOrganizationSettings puts to /organization-settings", async () => {
    putMock.mockResolvedValueOnce({ id: "cs-1" })
    await updateOrganizationSettings({ organizationName: "Updated" } as Parameters<typeof updateOrganizationSettings>[0])
    expect(putMock).toHaveBeenCalledWith("/organization-settings", expect.anything())
  })

  it("fetchBookingFlowOrder calls /organization/settings/booking-flow", async () => {
    getMock.mockResolvedValueOnce({ bookingFlowOrder: "service_first" })
    const result = await fetchBookingFlowOrder()
    expect(getMock).toHaveBeenCalledWith("/organization/settings/booking-flow")
    expect(result).toBe("service_first")
  })

  it("updateBookingFlowOrder patches /organization/settings/booking-flow", async () => {
    patchMock.mockResolvedValueOnce({ bookingFlowOrder: "employee_first" })
    const result = await updateBookingFlowOrder("employee_first")
    expect(patchMock).toHaveBeenCalledWith("/organization/settings/booking-flow", { order: "employee_first" })
    expect(result).toBe("employee_first")
  })

  it("fetchPaymentSettings calls /organization/settings/payment", async () => {
    getMock.mockResolvedValueOnce({ paymentMoyasarEnabled: true })
    await fetchPaymentSettings()
    expect(getMock).toHaveBeenCalledWith("/organization/settings/payment")
  })

  it("updatePaymentSettings patches /organization/settings/payment", async () => {
    patchMock.mockResolvedValueOnce({ paymentMoyasarEnabled: false })
    await updatePaymentSettings({ paymentMoyasarEnabled: false })
    expect(patchMock).toHaveBeenCalledWith("/organization/settings/payment", { paymentMoyasarEnabled: false })
  })
})
