/**
 * Auth API — CareKit Dashboard
 *
 * Refresh tokens are managed via httpOnly cookies (set by backend).
 * Only the short-lived accessToken is kept in memory.
 */

import { api, setAccessToken, getAccessToken } from "@/lib/api"

/* ─── Types ─── */

export interface AuthUser {
  id: string
  email: string
  firstName: string
  lastName: string
  phone: string | null
  gender: string | null
  roles: { id: string; name: string; slug: string }[]
  permissions: string[]
}

export interface AuthResponse {
  user: AuthUser
  accessToken: string
  expiresIn: number
}

/* ─── Constants ─── */

const USER_KEY = "carekit_user"

/* ─── API Calls ─── */

export async function login(
  email: string,
  password: string,
): Promise<AuthResponse> {
  const data = await api.post<AuthResponse>("/auth/login", {
    email,
    password,
  })

  persistAuth(data)
  return data
}

export async function fetchMe(): Promise<AuthUser> {
  const data = await api.get<AuthUser>("/auth/me")
  localStorage.setItem(USER_KEY, JSON.stringify(data))
  return data
}

export async function refreshToken(): Promise<AuthResponse> {
  // Cookie is sent automatically via credentials: 'include'
  const data = await api.post<AuthResponse>("/auth/refresh-token")

  setAccessToken(data.accessToken)
  return data
}

export async function logoutApi(): Promise<void> {
  try {
    await api.post("/auth/logout")
  } catch {
    // Ignore logout API errors — clear local state regardless
  }
  clearAuth()
}

export function logout() {
  clearAuth()
}

export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  await api.patch("/auth/password/change", { currentPassword, newPassword })
}

/* ─── Local State Helpers ─── */

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

/* ─── Internal ─── */

function persistAuth(data: AuthResponse) {
  localStorage.setItem(USER_KEY, JSON.stringify(data.user))
  setAccessToken(data.accessToken)
}

function clearAuth() {
  localStorage.removeItem(USER_KEY)
  setAccessToken(null)
}
