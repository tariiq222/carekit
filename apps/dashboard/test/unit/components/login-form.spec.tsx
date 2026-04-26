import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { useEffect } from "react"

const loginMock = vi.fn()

vi.mock("@/components/providers/auth-provider", () => ({
  useAuth: () => ({ login: loginMock }),
}))

vi.mock("@hcaptcha/react-hcaptcha", () => ({
  default: ({ onVerify }: { onVerify: (token: string) => void }) => {
    // Automatically verify in tests so the submit button is enabled
    useEffect(() => {
      onVerify("dev-bypass")
    }, [onVerify])
    return <div data-testid="hcaptcha" />
  },
}))

import { LoginForm } from "@/components/features/login-form"
import { LocaleProvider } from "@/components/locale-provider"

function getPasswordInput() {
  return document.getElementById("password") as HTMLInputElement
}

function renderLoginForm() {
  return render(
    <LocaleProvider>
      <LoginForm />
    </LocaleProvider>
  )
}

describe("LoginForm", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv("NODE_ENV", "test")
    vi.stubEnv("NEXT_PUBLIC_DEV_EMAIL", "")
    vi.stubEnv("NEXT_PUBLIC_DEV_PASSWORD", "")
  })

  it("renders email and password fields", () => {
    renderLoginForm()
    expect(screen.getByRole("textbox", { name: /البريد الإلكتروني/i })).toBeInTheDocument()
    expect(getPasswordInput()).toBeInTheDocument()
  })

  it("renders submit button", () => {
    renderLoginForm()
    expect(screen.getByRole("button", { name: /تسجيل الدخول/i })).toBeInTheDocument()
  })

  it("calls login with email and password on submit", async () => {
    loginMock.mockResolvedValueOnce(undefined)
    renderLoginForm()

    await userEvent.type(screen.getByRole("textbox", { name: /البريد الإلكتروني/i }), "admin@test.com")
    await userEvent.type(getPasswordInput(), "password123")
    await userEvent.click(screen.getByRole("button", { name: /تسجيل الدخول/i }))

    await waitFor(() => {
      expect(loginMock).toHaveBeenCalledWith("admin@test.com", "password123", "dev-bypass")
    })
  })

  it("shows loading state during submit", async () => {
    loginMock.mockReturnValueOnce(new Promise(() => undefined))
    renderLoginForm()

    await userEvent.type(screen.getByRole("textbox", { name: /البريد الإلكتروني/i }), "admin@test.com")
    await userEvent.type(getPasswordInput(), "password123")
    await userEvent.click(screen.getByRole("button", { name: /تسجيل الدخول/i }))

    await waitFor(() => {
      expect(screen.getByText(/جارٍ تسجيل الدخول/i)).toBeInTheDocument()
    })
  })

  it("shows error message on login failure", async () => {
    loginMock.mockRejectedValueOnce(new Error("بيانات غير صحيحة"))
    renderLoginForm()

    await userEvent.type(screen.getByRole("textbox", { name: /البريد الإلكتروني/i }), "admin@test.com")
    await userEvent.type(getPasswordInput(), "wrong")
    await userEvent.click(screen.getByRole("button", { name: /تسجيل الدخول/i }))

    await waitFor(() => {
      expect(screen.getByText(/بيانات غير صحيحة/i)).toBeInTheDocument()
    })
  })

  it("shows generic error for non-Error throws", async () => {
    loginMock.mockRejectedValueOnce("unknown error")
    renderLoginForm()

    await userEvent.type(screen.getByRole("textbox", { name: /البريد الإلكتروني/i }), "admin@test.com")
    await userEvent.type(getPasswordInput(), "wrong")
    await userEvent.click(screen.getByRole("button", { name: /تسجيل الدخول/i }))

    await waitFor(() => {
      expect(screen.getByText(/Invalid credentials/i)).toBeInTheDocument()
    })
  })

  it("toggles password visibility", async () => {
    renderLoginForm()

    expect(getPasswordInput()).toHaveAttribute("type", "password")

    const toggleBtn = screen.getByRole("button", { name: /إظهار كلمة المرور/i })
    await userEvent.click(toggleBtn)

    expect(getPasswordInput()).toHaveAttribute("type", "text")
    expect(screen.getByRole("button", { name: /إخفاء كلمة المرور/i })).toBeInTheDocument()
  })

  it("does not show dev login button in production", () => {
    vi.stubEnv("NODE_ENV", "production")
    renderLoginForm()
    expect(screen.queryByText(/Dev Admin Login/i)).toBeNull()
  })

  it("shows dev login button when env vars are set", () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("NEXT_PUBLIC_DEV_EMAIL", "dev@test.com")
    vi.stubEnv("NEXT_PUBLIC_DEV_PASSWORD", "devpass")
    renderLoginForm()
    expect(screen.getByText(/Dev Admin Login/i)).toBeInTheDocument()
  })

  it("calls login with dev credentials on dev button click", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("NEXT_PUBLIC_DEV_EMAIL", "dev@test.com")
    vi.stubEnv("NEXT_PUBLIC_DEV_PASSWORD", "devpass")
    loginMock.mockResolvedValueOnce(undefined)
    renderLoginForm()

    await userEvent.click(screen.getByText(/Dev Admin Login/i))

    await waitFor(() => {
      expect(loginMock).toHaveBeenCalledWith("dev@test.com", "devpass", "dev-bypass")
    })
  })

  it("clears error on new submit attempt", async () => {
    loginMock.mockRejectedValueOnce(new Error("خطأ"))
    renderLoginForm()

    await userEvent.type(screen.getByRole("textbox", { name: /البريد الإلكتروني/i }), "a@b.com")
    await userEvent.type(getPasswordInput(), "123")
    await userEvent.click(screen.getByRole("button", { name: /تسجيل الدخول/i }))

    await waitFor(() => expect(screen.getByText(/خطأ/i)).toBeInTheDocument())

    loginMock.mockResolvedValueOnce(undefined)
    await userEvent.click(screen.getByRole("button", { name: /تسجيل الدخول/i }))

    await waitFor(() => expect(screen.queryByText(/خطأ/i)).toBeNull())
  })
})
