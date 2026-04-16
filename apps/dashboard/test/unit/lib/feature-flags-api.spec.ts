import { beforeEach, describe, expect, it, vi } from "vitest"

const { getMock, patchMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  patchMock: vi.fn(),
}))

vi.mock("@/lib/api", () => ({
  api: { get: getMock, patch: patchMock },
}))

import {
  fetchFeatureFlags,
  fetchFeatureFlagMap,
  updateFeatureFlag,
} from "@/lib/api/feature-flags"

describe("feature-flags api", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("fetchFeatureFlags calls /feature-flags", async () => {
    getMock.mockResolvedValueOnce([{ key: "chatbot", enabled: true }])
    await fetchFeatureFlags()
    expect(getMock).toHaveBeenCalledWith("/dashboard/platform/feature-flags")
  })

  it("fetchFeatureFlagMap calls /feature-flags/map", async () => {
    getMock.mockResolvedValueOnce({ chatbot: true, ratings: false })
    await fetchFeatureFlagMap()
    expect(getMock).toHaveBeenCalledWith("/dashboard/platform/feature-flags/map")
  })

  it("updateFeatureFlag patches /feature-flags/:key", async () => {
    patchMock.mockResolvedValueOnce({ key: "chatbot", enabled: false })
    await updateFeatureFlag("chatbot", false)
    expect(patchMock).toHaveBeenCalledWith("/dashboard/platform/feature-flags/chatbot", { enabled: false })
  })
})
