import { beforeEach, describe, expect, it, vi } from "vitest"

const { getMock, putMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  putMock: vi.fn(),
}))

vi.mock("@/lib/api", () => ({
  api: { get: getMock, put: putMock },
}))

import { fetchWhitelabel, fetchPublicBranding, updateWhitelabel } from "@/lib/api/whitelabel"

describe("whitelabel api", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("fetchWhitelabel calls /whitelabel", async () => {
    getMock.mockResolvedValueOnce({ colorPrimary: "#354FD8" })
    await fetchWhitelabel()
    expect(getMock).toHaveBeenCalledWith("/whitelabel")
  })

  it("fetchPublicBranding calls /whitelabel/public", async () => {
    getMock.mockResolvedValueOnce({ logo: "https://example.com/logo.png" })
    await fetchPublicBranding()
    expect(getMock).toHaveBeenCalledWith("/whitelabel/public")
  })

  it("updateWhitelabel puts to /whitelabel", async () => {
    putMock.mockResolvedValueOnce({ colorPrimary: "#000000" })
    await updateWhitelabel({ colorPrimary: "#000000" } as Parameters<typeof updateWhitelabel>[0])
    expect(putMock).toHaveBeenCalledWith("/whitelabel", expect.anything())
  })
})
