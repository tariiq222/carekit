import { beforeEach, describe, expect, it, vi } from "vitest"

const { getMock, putMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  putMock: vi.fn(),
}))

vi.mock("@/lib/api", () => ({
  api: { get: getMock, put: putMock },
}))

import { fetchBranding, fetchPublicBranding, updateBranding } from "@/lib/api/branding"

describe("branding api", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("fetchBranding calls /branding", async () => {
    getMock.mockResolvedValueOnce({ colorPrimary: "#354FD8" })
    await fetchBranding()
    expect(getMock).toHaveBeenCalledWith("/branding")
  })

  it("fetchPublicBranding calls /branding/public", async () => {
    getMock.mockResolvedValueOnce({ logo: "https://example.com/logo.png" })
    await fetchPublicBranding()
    expect(getMock).toHaveBeenCalledWith("/branding/public")
  })

  it("updateBranding puts to /branding", async () => {
    putMock.mockResolvedValueOnce({ colorPrimary: "#000000" })
    await updateBranding({ colorPrimary: "#000000" } as Parameters<typeof updateBranding>[0])
    expect(putMock).toHaveBeenCalledWith("/branding", expect.anything())
  })
})
