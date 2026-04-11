import { beforeEach, describe, expect, it, vi } from "vitest"

const { getMock, putMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  putMock: vi.fn(),
}))

vi.mock("@/lib/api", () => ({
  api: { get: getMock, put: putMock },
}))

import { fetchLicense, fetchLicenseFeatures, updateLicense } from "@/lib/api/license"

describe("license api", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("fetchLicense calls /license", async () => {
    getMock.mockResolvedValueOnce({ plan: "pro", expiresAt: "2026-12-31" })
    await fetchLicense()
    expect(getMock).toHaveBeenCalledWith("/license")
  })

  it("fetchLicenseFeatures calls /license/features", async () => {
    getMock.mockResolvedValueOnce([{ key: "chatbot", enabled: true }])
    await fetchLicenseFeatures()
    expect(getMock).toHaveBeenCalledWith("/license/features")
  })

  it("updateLicense puts to /license", async () => {
    putMock.mockResolvedValueOnce({ plan: "enterprise" })
    await updateLicense({ plan: "enterprise" } as Parameters<typeof updateLicense>[0])
    expect(putMock).toHaveBeenCalledWith("/license", expect.anything())
  })
})
