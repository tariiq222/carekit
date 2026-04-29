import { beforeEach, describe, expect, it, vi } from "vitest"

const { getMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
}))

vi.mock("@/lib/api", () => ({
  api: { get: getMock },
}))

import {
  fetchFeatureFlags,
  fetchFeatureFlagMap,
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

})
