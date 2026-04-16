import { beforeEach, describe, expect, it, vi } from "vitest"

const { getMock, postMock, patchMock, setAccessTokenMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn(),
  patchMock: vi.fn(),
  setAccessTokenMock: vi.fn(),
}))

vi.mock("@/lib/api", () => ({
  api: { get: getMock, post: postMock, patch: patchMock },
  setAccessToken: setAccessTokenMock,
  getAccessToken: vi.fn(() => null),
}))

import {
  login,
  fetchMe,
  refreshToken,
  logoutApi,
  logout,
  changePassword,
  getStoredUser,
} from "@/lib/api/auth"

describe("auth api", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it("login calls POST /auth/login and persists auth", async () => {
    const mockResponse = {
      user: { id: "1", email: "a@b.com", firstName: "A", lastName: "B", phone: null, gender: null, roles: [], permissions: [] },
      accessToken: "token123",
      expiresIn: 3600,
    }
    postMock.mockResolvedValueOnce(mockResponse)

    const result = await login("a@b.com", "pass")

    expect(postMock).toHaveBeenCalledWith("/auth/login", { email: "a@b.com", password: "pass" })
    expect(setAccessTokenMock).toHaveBeenCalledWith("token123")
    expect(localStorage.getItem("carekit_user")).toContain("a@b.com")
    expect(result.accessToken).toBe("token123")
  })

  it("fetchMe calls GET /auth/me and stores user", async () => {
    const user = { id: "1", email: "a@b.com", firstName: "A", lastName: "B", phone: null, gender: null, roles: [], permissions: [] }
    getMock.mockResolvedValueOnce(user)

    const result = await fetchMe()

    expect(getMock).toHaveBeenCalledWith("/auth/me")
    expect(localStorage.getItem("carekit_user")).toContain("a@b.com")
    expect(result.email).toBe("a@b.com")
  })

  it("refreshToken calls POST /auth/refresh and sets access token", async () => {
    localStorage.setItem("carekit_refresh_token", "stored-rt")
    postMock.mockResolvedValueOnce({ accessToken: "newToken", user: { id: "1" }, expiresIn: 3600 })

    await refreshToken()

    expect(postMock).toHaveBeenCalledWith("/auth/refresh", { refreshToken: "stored-rt" })
    expect(setAccessTokenMock).toHaveBeenCalledWith("newToken")
  })

  it("logoutApi calls POST /auth/logout and clears auth", async () => {
    postMock.mockResolvedValueOnce(undefined)
    localStorage.setItem("carekit_user", "{}")

    await logoutApi()

    expect(postMock).toHaveBeenCalledWith("/auth/logout")
    expect(localStorage.getItem("carekit_user")).toBeNull()
    expect(setAccessTokenMock).toHaveBeenCalledWith(null)
  })

  it("logoutApi clears auth even when API call fails", async () => {
    postMock.mockRejectedValueOnce(new Error("fail"))
    localStorage.setItem("carekit_user", "{}")

    await logoutApi()

    expect(localStorage.getItem("carekit_user")).toBeNull()
    expect(setAccessTokenMock).toHaveBeenCalledWith(null)
  })

  it("logout clears auth without API call", () => {
    localStorage.setItem("carekit_user", "{}")
    logout()
    expect(localStorage.getItem("carekit_user")).toBeNull()
    expect(setAccessTokenMock).toHaveBeenCalledWith(null)
  })

  it("changePassword calls PATCH /auth/password/change", async () => {
    patchMock.mockResolvedValueOnce(undefined)
    await changePassword("oldPass", "newPass")
    expect(patchMock).toHaveBeenCalledWith("/auth/password/change", { currentPassword: "oldPass", newPassword: "newPass" })
  })

  it("getStoredUser returns null when no user stored", () => {
    expect(getStoredUser()).toBeNull()
  })

  it("getStoredUser returns parsed user when stored", () => {
    const user = { id: "1", email: "a@b.com", firstName: "A", lastName: "B", phone: null, gender: null, roles: [], permissions: [] }
    localStorage.setItem("carekit_user", JSON.stringify(user))
    expect(getStoredUser()).toEqual(user)
  })

  it("getStoredUser returns null for invalid JSON", () => {
    localStorage.setItem("carekit_user", "not-json")
    expect(getStoredUser()).toBeNull()
  })
})
