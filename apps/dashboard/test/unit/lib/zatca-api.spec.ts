import { beforeEach, describe, expect, it, vi } from "vitest"

const { getMock, postMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn(),
}))

vi.mock("@/lib/api", () => ({
  api: { get: getMock, post: postMock },
}))

import {
  fetchZatcaConfig,
  onboardZatca,
  fetchOnboardingStatus,
  reportToSandbox,
} from "@/lib/api/zatca"

describe("zatca api", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("fetchZatcaConfig calls GET /dashboard/finance/zatca/config", async () => {
    getMock.mockResolvedValueOnce({ isOnboarded: false })
    await fetchZatcaConfig()
    expect(getMock).toHaveBeenCalledWith("/dashboard/finance/zatca/config")
  })

  it("onboardZatca calls POST /dashboard/finance/zatca/onboard", async () => {
    postMock.mockResolvedValueOnce({})
    await onboardZatca({ vatRegistrationNumber: "123", sellerName: "Clinic" })
    expect(postMock).toHaveBeenCalledWith("/dashboard/finance/zatca/onboard", { vatRegistrationNumber: "123", sellerName: "Clinic" })
  })

  it("fetchOnboardingStatus calls GET /dashboard/finance/zatca/config", async () => {
    getMock.mockResolvedValueOnce({ isOnboarded: true })
    await fetchOnboardingStatus()
    expect(getMock).toHaveBeenCalledWith("/dashboard/finance/zatca/config")
  })

  it("reportToSandbox calls POST /dashboard/finance/zatca/submit", async () => {
    postMock.mockResolvedValueOnce({})
    await reportToSandbox("inv-1")
    expect(postMock).toHaveBeenCalledWith("/dashboard/finance/zatca/submit", { invoiceId: "inv-1" })
  })
})
