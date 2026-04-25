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
const REFRESH_KEY = "carekit_refresh_token"

export async function login(
  email: string,
  password: string,
): Promise<AuthResponse> {
  const data = await authApi.login({ email, password })
  persistAuth(data)
  return data
}

export async function fetchMe(): Promise<AuthUser> {
  const data = await authApi.getMe()
  localStorage.setItem(USER_KEY, JSON.stringify(data))
  return data
}

export async function refreshToken(): Promise<AuthResponse> {
  const stored = typeof window !== "undefined"
    ? localStorage.getItem(REFRESH_KEY)
    : null
  if (!stored) throw new Error("No refresh token")

  const tokens = await authApi.refreshToken(stored)
  setAccessToken(tokens.accessToken)
  if (tokens.refreshToken) localStorage.setItem(REFRESH_KEY, tokens.refreshToken)
  // Refresh endpoint does not return user — keep the previously cached one.
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
  if (data.refreshToken) localStorage.setItem(REFRESH_KEY, data.refreshToken)
}

function clearAuth(): void {
  localStorage.removeItem(USER_KEY)
  localStorage.removeItem(REFRESH_KEY)
  setAccessToken(null)
}
