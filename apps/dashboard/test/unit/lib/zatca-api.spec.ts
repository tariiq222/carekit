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
  fetchSandboxStats,
  reportToSandbox,
} from "@/lib/api/zatca"

describe("zatca api", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("fetchZatcaConfig calls GET /zatca/config", async () => {
    getMock.mockResolvedValueOnce({ otp: "123", sandboxMode: true })
    await fetchZatcaConfig()
    expect(getMock).toHaveBeenCalledWith("/zatca/config")
  })

  it("onboardZatca calls POST /zatca/onboard", async () => {
    postMock.mockResolvedValueOnce({})
    await onboardZatca({ otp: "123" } as never)
    expect(postMock).toHaveBeenCalledWith("/zatca/onboard", { otp: "123" })
  })

  it("fetchOnboardingStatus calls GET /zatca/onboarding/status", async () => {
    getMock.mockResolvedValueOnce({ status: "pending" })
    await fetchOnboardingStatus()
    expect(getMock).toHaveBeenCalledWith("/zatca/onboarding/status")
  })

  it("fetchSandboxStats calls GET /zatca/sandbox/stats", async () => {
    getMock.mockResolvedValueOnce({ total: 10, reported: 5 })
    await fetchSandboxStats()
    expect(getMock).toHaveBeenCalledWith("/zatca/sandbox/stats")
  })

  it("reportToSandbox calls POST /zatca/sandbox/report/:invoiceId", async () => {
    postMock.mockResolvedValueOnce({})
    await reportToSandbox("inv-1")
    expect(postMock).toHaveBeenCalledWith("/zatca/sandbox/report/inv-1")
  })
})
