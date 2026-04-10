import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

const loginMock = vi.fn()

vi.mock("@/components/providers/auth-provider", () => ({
  useAuth: () => ({ login: loginMock }),
}))

import { LoginForm } from "@/components/features/login-form"

function getPasswordInput() {
  return document.getElementById("password") as HTMLInputElement
}

describe("LoginForm", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv("NODE_ENV", "test")
    vi.stubEnv("NEXT_PUBLIC_DEV_EMAIL", "")
    vi.stubEnv("NEXT_PUBLIC_DEV_PASSWORD", "")
  })

  it("renders email and password fields", () => {
    render(<LoginForm />)
    expect(screen.getByRole("textbox", { name: /البريد الإلكتروني/i })).toBeInTheDocument()
    expect(getPasswordInput()).toBeInTheDocument()
  })

  it("renders submit button", () => {
    render(<LoginForm />)
    expect(screen.getByRole("button", { name: /تسجيل الدخول/i })).toBeInTheDocument()
  })

  it("calls login with email and password on submit", async () => {
    loginMock.mockResolvedValueOnce(undefined)
    render(<LoginForm />)

    await userEvent.type(screen.getByRole("textbox", { name: /البريد الإلكتروني/i }), "admin@test.com")
    await userEvent.type(getPasswordInput(), "password123")
    await userEvent.click(screen.getByRole("button", { name: /تسجيل الدخول/i }))

    await waitFor(() => {
      expect(loginMock).toHaveBeenCalledWith("admin@test.com", "password123")
    })
  })

  it("shows loading state during submit", async () => {
    loginMock.mockReturnValueOnce(new Promise(() => undefined))
    render(<LoginForm />)

    await userEvent.type(screen.getByRole("textbox", { name: /البريد الإلكتروني/i }), "admin@test.com")
    await userEvent.type(getPasswordInput(), "password123")
    await userEvent.click(screen.getByRole("button", { name: /تسجيل الدخول/i }))

    await waitFor(() => {
      expect(screen.getByText(/جارٍ تسجيل الدخول/i)).toBeInTheDocument()
    })
  })

  it("shows error message on login failure", async () => {
    loginMock.mockRejectedValueOnce(new Error("بيانات غير صحيحة"))
    render(<LoginForm />)

    await userEvent.type(screen.getByRole("textbox", { name: /البريد الإلكتروني/i }), "admin@test.com")
    await userEvent.type(getPasswordInput(), "wrong")
    await userEvent.click(screen.getByRole("button", { name: /تسجيل الدخول/i }))

    await waitFor(() => {
      expect(screen.getByText(/بيانات غير صحيحة/i)).toBeInTheDocument()
    })
  })

  it("shows generic error for non-Error throws", async () => {
    loginMock.mockRejectedValueOnce("unknown error")
    render(<LoginForm />)

    await userEvent.type(screen.getByRole("textbox", { name: /البريد الإلكتروني/i }), "admin@test.com")
    await userEvent.type(getPasswordInput(), "wrong")
    await userEvent.click(screen.getByRole("button", { name: /تسجيل الدخول/i }))

    await waitFor(() => {
      expect(screen.getByText(/Invalid credentials/i)).toBeInTheDocument()
    })
  })

  it("toggles password visibility", async () => {
    render(<LoginForm />)

    expect(getPasswordInput()).toHaveAttribute("type", "password")

    const toggleBtn = screen.getByRole("button", { name: /إظهار كلمة المرور/i })
    await userEvent.click(toggleBtn)

    expect(getPasswordInput()).toHaveAttribute("type", "text")
    expect(screen.getByRole("button", { name: /إخفاء كلمة المرور/i })).toBeInTheDocument()
  })

  it("does not show dev login button in production", () => {
    vi.stubEnv("NODE_ENV", "production")
    render(<LoginForm />)
    expect(screen.queryByText(/Dev Admin Login/i)).toBeNull()
  })

  it("shows dev login button when env vars are set", () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("NEXT_PUBLIC_DEV_EMAIL", "dev@test.com")
    vi.stubEnv("NEXT_PUBLIC_DEV_PASSWORD", "devpass")
    render(<LoginForm />)
    expect(screen.getByText(/Dev Admin Login/i)).toBeInTheDocument()
  })

  it("calls login with dev credentials on dev button click", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("NEXT_PUBLIC_DEV_EMAIL", "dev@test.com")
    vi.stubEnv("NEXT_PUBLIC_DEV_PASSWORD", "devpass")
    loginMock.mockResolvedValueOnce(undefined)
    render(<LoginForm />)

    await userEvent.click(screen.getByText(/Dev Admin Login/i))

    await waitFor(() => {
      expect(loginMock).toHaveBeenCalledWith("dev@test.com", "devpass")
    })
  })

  it("clears error on new submit attempt", async () => {
    loginMock.mockRejectedValueOnce(new Error("خطأ"))
    render(<LoginForm />)

    await userEvent.type(screen.getByRole("textbox", { name: /البريد الإلكتروني/i }), "a@b.com")
    await userEvent.type(getPasswordInput(), "123")
    await userEvent.click(screen.getByRole("button", { name: /تسجيل الدخول/i }))

    await waitFor(() => expect(screen.getByText(/خطأ/i)).toBeInTheDocument())

    loginMock.mockResolvedValueOnce(undefined)
    await userEvent.click(screen.getByRole("button", { name: /تسجيل الدخول/i }))

    await waitFor(() => expect(screen.queryByText(/خطأ/i)).toBeNull())
  })
})
