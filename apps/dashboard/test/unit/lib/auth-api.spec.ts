import { beforeEach, describe, expect, it, vi } from "vitest"

const {
  loginMock,
  refreshTokenMock,
  getMeMock,
  logoutMock,
  changePasswordMock,
  setAccessTokenMock,
} = vi.hoisted(() => ({
  loginMock: vi.fn(),
  refreshTokenMock: vi.fn(),
  getMeMock: vi.fn(),
  logoutMock: vi.fn(),
  changePasswordMock: vi.fn(),
  setAccessTokenMock: vi.fn(),
}))

vi.mock("@carekit/api-client", () => ({
  authApi: {
    login: loginMock,
    refreshToken: refreshTokenMock,
    getMe: getMeMock,
    logout: logoutMock,
    changePassword: changePasswordMock,
  },
  initClient: vi.fn(),
}))

vi.mock("@/lib/api", () => ({
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

const fakeUser = {
  id: "1",
  email: "a@b.com",
  name: "A B",
  firstName: "A",
  lastName: "B",
  phone: null,
  gender: null,
  avatarUrl: null,
  isActive: true,
  role: "OWNER",
  customRoleId: null,
  isSuperAdmin: false,
  permissions: [],
  organizationId: "org_test",
}

describe("auth api", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it("login delegates to authApi.login and persists tokens + user", async () => {
    loginMock.mockResolvedValueOnce({
      accessToken: "token123",
      refreshToken: "rt123",
      expiresIn: 900,
      user: fakeUser,
    })

    const result = await login("a@b.com", "pass")

    expect(loginMock).toHaveBeenCalledWith({ email: "a@b.com", password: "pass" })
    expect(setAccessTokenMock).toHaveBeenCalledWith("token123")
    expect(localStorage.getItem("carekit_user")).toContain("a@b.com")
    expect(localStorage.getItem("carekit_refresh_token")).toBe("rt123")
    expect(result.accessToken).toBe("token123")
  })

  it("fetchMe delegates to authApi.getMe and stores user", async () => {
    getMeMock.mockResolvedValueOnce(fakeUser)

    const result = await fetchMe()

    expect(getMeMock).toHaveBeenCalledOnce()
    expect(localStorage.getItem("carekit_user")).toContain("a@b.com")
    expect(result.email).toBe("a@b.com")
  })

  it("refreshToken passes the stored refresh token and updates access token", async () => {
    localStorage.setItem("carekit_refresh_token", "stored-rt")
    refreshTokenMock.mockResolvedValueOnce({
      accessToken: "newToken",
      refreshToken: "newRt",
      expiresIn: 900,
    })

    const result = await refreshToken()

    expect(refreshTokenMock).toHaveBeenCalledWith("stored-rt")
    expect(setAccessTokenMock).toHaveBeenCalledWith("newToken")
    expect(localStorage.getItem("carekit_refresh_token")).toBe("newRt")
    expect(result.accessToken).toBe("newToken")
  })

  it("refreshToken throws when no stored refresh token", async () => {
    await expect(refreshToken()).rejects.toThrow("No refresh token")
    expect(refreshTokenMock).not.toHaveBeenCalled()
  })

  it("logoutApi delegates to authApi.logout and clears state", async () => {
    logoutMock.mockResolvedValueOnce(undefined)
    localStorage.setItem("carekit_user", "{}")

    await logoutApi()

    expect(logoutMock).toHaveBeenCalledOnce()
    expect(localStorage.getItem("carekit_user")).toBeNull()
    expect(setAccessTokenMock).toHaveBeenCalledWith(null)
  })

  it("logoutApi still clears state when API call fails", async () => {
    logoutMock.mockRejectedValueOnce(new Error("fail"))
    localStorage.setItem("carekit_user", "{}")

    await logoutApi()

    expect(localStorage.getItem("carekit_user")).toBeNull()
    expect(setAccessTokenMock).toHaveBeenCalledWith(null)
  })

  it("logout clears state without API call", () => {
    localStorage.setItem("carekit_user", "{}")
    logout()
    expect(localStorage.getItem("carekit_user")).toBeNull()
    expect(setAccessTokenMock).toHaveBeenCalledWith(null)
    expect(logoutMock).not.toHaveBeenCalled()
  })

  it("changePassword delegates to authApi.changePassword", async () => {
    changePasswordMock.mockResolvedValueOnce(undefined)
    await changePassword("oldPass", "newPass")
    expect(changePasswordMock).toHaveBeenCalledWith({
      currentPassword: "oldPass",
      newPassword: "newPass",
    })
  })

  it("getStoredUser returns null when no user stored", () => {
    expect(getStoredUser()).toBeNull()
  })

  it("getStoredUser returns parsed user when stored", () => {
    localStorage.setItem("carekit_user", JSON.stringify(fakeUser))
    expect(getStoredUser()).toEqual(fakeUser)
  })

  it("getStoredUser returns null for invalid JSON", () => {
    localStorage.setItem("carekit_user", "not-json")
    expect(getStoredUser()).toBeNull()
  })
})
