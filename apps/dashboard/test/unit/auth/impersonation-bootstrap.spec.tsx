import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import { AuthProvider, useAuth } from "@/components/providers/auth-provider"

const mockGetMe = vi.fn()
const mockRefreshToken = vi.fn()
const mockSetAccessToken = vi.fn()

vi.mock("@deqah/api-client", () => ({
  authApi: {
    getMe: (...args: unknown[]) => mockGetMe(...args),
    refreshToken: (...args: unknown[]) => mockRefreshToken(...args),
    logout: vi.fn(),
  },
}))

vi.mock("@/lib/api", () => ({
  setAccessToken: (...args: unknown[]) => mockSetAccessToken(...args),
  getAccessToken: vi.fn(() => null),
}))

const mockUser = {
  id: "user-1",
  email: "impersonated@carekit.test",
  name: "Impersonated User",
  permissions: ["bookings:read"],
  organizationId: "org-1",
}

function Consumer() {
  const { user, loading } = useAuth()
  return (
    <div>
      <div data-testid="loading">{loading ? "loading" : "ready"}</div>
      <div data-testid="user">{user?.email ?? "none"}</div>
    </div>
  )
}

describe("dashboard impersonation bootstrap", () => {
  beforeEach(() => {
    mockGetMe.mockReset()
    mockRefreshToken.mockReset()
    mockSetAccessToken.mockReset()
    localStorage.clear()
    sessionStorage.clear()
    window.history.pushState({}, "", "/?_impersonation=shadow.jwt&tab=today")
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("accepts shadow token before refresh, fetches the user, and cleans the URL", async () => {
    const replaceState = vi.spyOn(window.history, "replaceState")
    mockGetMe.mockResolvedValue(mockUser)
    mockRefreshToken.mockRejectedValue(new Error("refresh must not run"))

    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    )

    await waitFor(() =>
      expect(screen.getByTestId("loading").textContent).toBe("ready"),
    )

    expect(mockSetAccessToken).toHaveBeenCalledWith("shadow.jwt")
    expect(mockRefreshToken).not.toHaveBeenCalled()
    expect(mockGetMe).toHaveBeenCalledOnce()
    expect(screen.getByTestId("user").textContent).toBe(mockUser.email)
    expect(sessionStorage.getItem("carekit_impersonation")).toBe("1")
    expect(replaceState).toHaveBeenCalled()
    expect(window.location.search).toBe("?tab=today")
  })
})
