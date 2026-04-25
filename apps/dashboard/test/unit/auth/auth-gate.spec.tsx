/**
 * AuthGate — unit tests
 *
 * Covers:
 *  - Loading state: shows spinner while auth resolves
 *  - Unauthenticated: shows LoginForm when user is null
 *  - Authenticated: renders children when user is set
 *  - LoginForm renders email + password fields
 *  - LoginForm shows error on invalid credentials
 *  - LoginForm calls login() with correct values on submit
 *  - DA-S3: logout → LoginForm replaces protected content
 *  - DA-S4: protected content inaccessible after logout
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React, { useEffect } from 'react'

// ---------------------------------------------------------------------------
// We test AuthGate by controlling what useAuth returns
// ---------------------------------------------------------------------------

const mockUseAuth = vi.fn()

vi.mock('@/components/providers/auth-provider', () => ({
  useAuth: () => mockUseAuth(),
}))

vi.mock("@hcaptcha/react-hcaptcha", () => ({
  default: ({ onVerify }: { onVerify: (token: string) => void }) => {
    // Automatically verify in tests so the submit button is enabled
    useEffect(() => {
      onVerify("test-token")
    }, [onVerify])
    return <div data-testid="hcaptcha" />
  },
}))

// Stub HugeIcons to avoid SVG rendering issues in jsdom
vi.mock('@hugeicons/react', () => ({
  HugeiconsIcon: () => null,
}))
vi.mock('@hugeicons/core-free-icons', () => ({
  EyeIcon: {},
  ScanEyeIcon: {},
}))

import { AuthGate } from '@/components/providers/auth-gate'
import { LocaleProvider } from '@/components/locale-provider'

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function renderAuthGate(children: React.ReactNode) {
  return render(
    <LocaleProvider>
      <AuthGate>{children}</AuthGate>
    </LocaleProvider>
  )
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const mockUser = {
  id: 'u1',
  email: 'admin@carekit-test.com',
  firstName: 'Admin',
  lastName: 'Test',
  phone: null,
  gender: null,
  roles: [],
  permissions: [],
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AuthGate', () => {
  beforeEach(() => {
    mockUseAuth.mockReset()
  })

  // =========================================================================
  // Loading state
  // =========================================================================

  it('should show loading spinner while auth is resolving', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: true, login: vi.fn(), logout: vi.fn() })

    renderAuthGate(<div data-testid="protected-content">Protected</div>)

    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument()
    // Loading indicator is present
    expect(document.querySelector('.border-primary')).toBeInTheDocument()
  })

  // =========================================================================
  // Unauthenticated — shows LoginForm
  // =========================================================================

  it('should show login form when user is null and not loading', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false, login: vi.fn(), logout: vi.fn() })

    renderAuthGate(<div data-testid="protected-content">Protected</div>)

    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument()
    expect(screen.getByLabelText(/البريد الإلكتروني/)).toBeInTheDocument()
    expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument()
  })

  // =========================================================================
  // Authenticated — renders children
  // =========================================================================

  it('should render children when user is authenticated', () => {
    mockUseAuth.mockReturnValue({ user: mockUser, loading: false, login: vi.fn(), logout: vi.fn() })

    renderAuthGate(<div data-testid="protected-content">Dashboard Content</div>)

    expect(screen.getByTestId('protected-content')).toBeInTheDocument()
    expect(screen.queryByLabelText(/البريد الإلكتروني/)).not.toBeInTheDocument()
  })

  // =========================================================================
  // LoginForm interaction
  // =========================================================================

  it('should call login() with entered email and password on submit', async () => {
    const mockLogin = vi.fn().mockResolvedValue(undefined)
    mockUseAuth.mockReturnValue({ user: null, loading: false, login: mockLogin, logout: vi.fn() })

    renderAuthGate(<div>Protected</div>)

    await userEvent.type(screen.getByLabelText(/البريد الإلكتروني/), 'admin@carekit-test.com')
    await userEvent.type(screen.getByPlaceholderText('••••••••'), 'Admin@Pass123')
    const btn = screen.getByRole('button', { name: /تسجيل الدخول/ })
    await waitFor(() => expect(btn).not.toBeDisabled())
    await userEvent.click(btn)

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('admin@carekit-test.com', 'Admin@Pass123', 'test-token')
    })
  })

  it('should display error message when login() throws', async () => {
    const mockLogin = vi.fn().mockRejectedValue(new Error('Invalid email or password'))
    mockUseAuth.mockReturnValue({ user: null, loading: false, login: mockLogin, logout: vi.fn() })

    renderAuthGate(<div>Protected</div>)

    await userEvent.type(screen.getByLabelText(/البريد الإلكتروني/), 'bad@test.com')
    await userEvent.type(screen.getByPlaceholderText('••••••••'), 'wrongpass')
    const btn = screen.getByRole('button', { name: /تسجيل الدخول/ })
    await waitFor(() => expect(btn).not.toBeDisabled())
    await userEvent.click(btn)

    await waitFor(() => {
      expect(screen.getByText('Invalid email or password')).toBeInTheDocument()
    })
  })

  // =========================================================================
  // DA-S3 / DA-S4 — logout flow
  // =========================================================================

  it('DA-S3: should show LoginForm after logout (protected content disappears)', async () => {
    // Start authenticated
    let authState: { user: typeof mockUser | null; loading: boolean; login: ReturnType<typeof vi.fn>; logout: ReturnType<typeof vi.fn> } = { user: mockUser, loading: false, login: vi.fn(), logout: vi.fn() }
    mockUseAuth.mockImplementation(() => authState)

    const { rerender } = render(
      <LocaleProvider>
        <AuthGate>
          <div data-testid="protected-content">Dashboard</div>
        </AuthGate>
      </LocaleProvider>
    )

    expect(screen.getByTestId('protected-content')).toBeInTheDocument()

    // Simulate logout — user becomes null
    authState = { user: null, loading: false, login: vi.fn(), logout: vi.fn() }
    rerender(
      <LocaleProvider>
        <AuthGate>
          <div data-testid="protected-content">Dashboard</div>
        </AuthGate>
      </LocaleProvider>
    )

    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument()
    expect(screen.getByLabelText(/البريد الإلكتروني/)).toBeInTheDocument()
  })

  it('DA-S4: should keep protected content inaccessible after logout', async () => {
    let authState: { user: typeof mockUser | null; loading: boolean; login: ReturnType<typeof vi.fn>; logout: ReturnType<typeof vi.fn> } = { user: mockUser, loading: false, login: vi.fn(), logout: vi.fn() }
    mockUseAuth.mockImplementation(() => authState)

    const { rerender } = render(
      <LocaleProvider>
        <AuthGate>
          <div data-testid="secret">Secret Data</div>
        </AuthGate>
      </LocaleProvider>
    )

    // Confirm content was visible
    expect(screen.getByTestId('secret')).toBeInTheDocument()

    // Logout
    authState = { user: null, loading: false, login: vi.fn(), logout: vi.fn() }
    rerender(
      <LocaleProvider>
        <AuthGate>
          <div data-testid="secret">Secret Data</div>
        </AuthGate>
      </LocaleProvider>
    )

    // Content must be gone, login form must be present
    expect(screen.queryByTestId('secret')).not.toBeInTheDocument()
    expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument()
  })

  it('should disable login button while submitting', async () => {
    // login() takes time — button must be disabled during inflight
    let resolve: () => void
    const mockLogin = vi.fn(
      () => new Promise<void>((res) => { resolve = res }),
    )
    mockUseAuth.mockReturnValue({ user: null, loading: false, login: mockLogin, logout: vi.fn() })

    renderAuthGate(<div>Protected</div>)

    await userEvent.type(screen.getByLabelText(/البريد الإلكتروني/), 'admin@test.com')
    await userEvent.type(screen.getByPlaceholderText('••••••••'), 'Pass123!')

    const btn = screen.getByRole('button', { name: /تسجيل الدخول/ })
    await waitFor(() => expect(btn).not.toBeDisabled())
    await userEvent.click(btn)

    expect(btn).toBeDisabled()

    // Resolve and unblock
    resolve!()
    await waitFor(() => expect(mockLogin).toHaveBeenCalledOnce())
  })
})
