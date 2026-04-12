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
  fetchZatcaConfig,
  onboardZatca,
  fetchOnboardingStatus,
  fetchSandboxStats,
  reportToSandbox,
} from "@/lib/api/zatca"

import {
  fetchActivityLogs,
} from "@/lib/api/activity-log"

import {
  fetchWaitlist,
  removeWaitlistEntry,
} from "@/lib/api/waitlist"

import {
  fetchFeatureFlags,
  fetchFeatureFlagMap,
  updateFeatureFlag,
} from "@/lib/api/feature-flags"

describe("zatca api", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("fetchZatcaConfig calls /zatca/config", async () => {
    getMock.mockResolvedValueOnce({})
    await fetchZatcaConfig()
    expect(getMock).toHaveBeenCalledWith("/zatca/config")
  })

  it("onboardZatca posts to /zatca/onboard", async () => {
    postMock.mockResolvedValueOnce({})
    await onboardZatca({ otp: "123456", vatNumber: "123" } as Parameters<typeof onboardZatca>[0])
    expect(postMock).toHaveBeenCalledWith("/zatca/onboard", expect.anything())
  })

  it("fetchOnboardingStatus calls /zatca/onboarding/status", async () => {
    getMock.mockResolvedValueOnce({})
    await fetchOnboardingStatus()
    expect(getMock).toHaveBeenCalledWith("/zatca/onboarding/status")
  })

  it("fetchSandboxStats calls /zatca/sandbox/stats", async () => {
    getMock.mockResolvedValueOnce({})
    await fetchSandboxStats()
    expect(getMock).toHaveBeenCalledWith("/zatca/sandbox/stats")
  })

  it("reportToSandbox posts to /zatca/sandbox/report/:invoiceId", async () => {
    postMock.mockResolvedValueOnce({})
    await reportToSandbox("inv-1")
    expect(postMock).toHaveBeenCalledWith("/zatca/sandbox/report/inv-1")
  })
})

describe("activity-log api", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("fetchActivityLogs calls /activity-log", async () => {
    getMock.mockResolvedValueOnce({ items: [], meta: {} })
    await fetchActivityLogs()
    expect(getMock).toHaveBeenCalledWith("/activity-log", expect.anything())
  })

})

describe("waitlist api", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("fetchWaitlist calls /bookings/waitlist", async () => {
    getMock.mockResolvedValueOnce([])
    await fetchWaitlist()
    expect(getMock).toHaveBeenCalledWith("/bookings/waitlist", undefined)
  })

  it("removeWaitlistEntry deletes /bookings/waitlist/:id", async () => {
    deleteMock.mockResolvedValueOnce(undefined)
    await removeWaitlistEntry("wl-1")
    expect(deleteMock).toHaveBeenCalledWith("/bookings/waitlist/wl-1")
  })
})

describe("feature-flags api", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("fetchFeatureFlags calls /feature-flags", async () => {
    getMock.mockResolvedValueOnce([])
    await fetchFeatureFlags()
    expect(getMock).toHaveBeenCalledWith("/feature-flags")
  })

  it("fetchFeatureFlagMap calls /feature-flags/map", async () => {
    getMock.mockResolvedValueOnce({})
    await fetchFeatureFlagMap()
    expect(getMock).toHaveBeenCalledWith("/feature-flags/map")
  })

  it("updateFeatureFlag patches /feature-flags/:key", async () => {
    patchMock.mockResolvedValueOnce({})
    await updateFeatureFlag("waitlist", true)
    expect(patchMock).toHaveBeenCalledWith("/feature-flags/waitlist", { enabled: true })
  })
})
