/**
 * Auth API — CareKit Dashboard
 *
 * Thin wrapper over @carekit/api-client/authApi. The shared package owns
 * request shape, envelope unwrapping, and 401 retry logic; this file only
 * adds persist/clear localStorage helpers and dashboard-specific aliases.
 */

import { authApi } from "@carekit/api-client"
import type { AuthResponse, UserPayload } from "@carekit/api-client"
import { setAccessToken, getAccessToken } from "@/lib/api"

export type AuthUser = UserPayload
export type { AuthResponse }

const USER_KEY = "carekit_user"

export async function login(
  email: string,
  password: string,
  hCaptchaToken: string,
): Promise<AuthResponse> {
  const data = await authApi.login({ email, password, hCaptchaToken })
  persistAuth(data)
  return data
}

export interface RegisterTenantPayload {
  name: string
  email: string
  phone: string
  password: string
  businessNameAr: string
  businessNameEn?: string
}

export async function registerTenant(payload: RegisterTenantPayload): Promise<AuthResponse> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/public/tenants/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error((body as { message?: string }).message ?? 'Registration failed')
  }
  const data = (await res.json()) as AuthResponse
  persistAuth(data)
  return data
}

export async function fetchMe(): Promise<AuthUser> {
  const data = await authApi.getMe()
  localStorage.setItem(USER_KEY, JSON.stringify(data))
  return data
}

export async function refreshToken(): Promise<AuthResponse> {
  const tokens = await authApi.refreshToken()
  setAccessToken(tokens.accessToken)
  const cached = getStoredUser()
  return {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresIn: tokens.expiresIn,
    user: cached as UserPayload,
  }
}

export async function logoutApi(): Promise<void> {
  try {
    await authApi.logout()
  } catch {
    // Ignore — clear local state regardless
  }
  clearAuth()
}

export function logout(): void {
  clearAuth()
}

export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  await authApi.changePassword({ currentPassword, newPassword })
}

export async function requestStaffPasswordReset(email: string): Promise<void> {
  await authApi.requestStaffPasswordReset(email)
}

export async function performStaffPasswordReset(
  token: string,
  newPassword: string,
): Promise<void> {
  await authApi.performStaffPasswordReset(token, newPassword)
}

export function getStoredUser(): AuthUser | null {
  if (typeof window === "undefined") return null
  const raw = localStorage.getItem(USER_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as AuthUser
  } catch {
    return null
  }
}

export function isAuthenticated(): boolean {
  return !!getAccessToken()
}

function persistAuth(data: AuthResponse): void {
  localStorage.setItem(USER_KEY, JSON.stringify(data.user))
  setAccessToken(data.accessToken)
}

function clearAuth(): void {
  localStorage.removeItem(USER_KEY)
  setAccessToken(null)
}
