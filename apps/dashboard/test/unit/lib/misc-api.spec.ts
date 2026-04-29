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
} from "@/lib/api/feature-flags"

describe("zatca api", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("fetchZatcaConfig calls /dashboard/finance/zatca/config", async () => {
    getMock.mockResolvedValueOnce({})
    await fetchZatcaConfig()
    expect(getMock).toHaveBeenCalledWith("/dashboard/finance/zatca/config")
  })

  it("onboardZatca posts to /dashboard/finance/zatca/onboard", async () => {
    postMock.mockResolvedValueOnce({})
    await onboardZatca({ vatRegistrationNumber: "123", sellerName: "Clinic" })
    expect(postMock).toHaveBeenCalledWith("/dashboard/finance/zatca/onboard", expect.anything())
  })

  it("fetchOnboardingStatus calls /dashboard/finance/zatca/config", async () => {
    getMock.mockResolvedValueOnce({})
    await fetchOnboardingStatus()
    expect(getMock).toHaveBeenCalledWith("/dashboard/finance/zatca/config")
  })

  it("reportToSandbox posts to /dashboard/finance/zatca/submit", async () => {
    postMock.mockResolvedValueOnce({})
    await reportToSandbox("inv-1")
    expect(postMock).toHaveBeenCalledWith("/dashboard/finance/zatca/submit", { invoiceId: "inv-1" })
  })
})

describe("activity-log api", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("fetchActivityLogs calls /activity-log", async () => {
    getMock.mockResolvedValueOnce({ items: [], meta: {} })
    await fetchActivityLogs()
    expect(getMock).toHaveBeenCalledWith("/dashboard/ops/activity", expect.anything())
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
    expect(deleteMock).toHaveBeenCalledWith("/dashboard/bookings/waitlist/wl-1")
  })
})

describe("feature-flags api", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("fetchFeatureFlags calls /feature-flags", async () => {
    getMock.mockResolvedValueOnce([])
    await fetchFeatureFlags()
    expect(getMock).toHaveBeenCalledWith("/dashboard/platform/feature-flags")
  })

  it("fetchFeatureFlagMap calls /feature-flags/map", async () => {
    getMock.mockResolvedValueOnce({})
    await fetchFeatureFlagMap()
    expect(getMock).toHaveBeenCalledWith("/dashboard/platform/feature-flags/map")
  })

})
