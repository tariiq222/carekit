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
  name: string
  phone: string | null
  gender: string | null
  role: string
  avatarUrl: string | null
  isActive: boolean
  permissions?: string[]
}

export interface AuthResponse {
  user: AuthUser
  accessToken: string
  refreshToken: string
  expiresIn: number
}

/* ─── Constants ─── */

const USER_KEY    = "carekit_user"
const REFRESH_KEY = "carekit_refresh_token"

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
  const storedRefresh = typeof window !== "undefined"
    ? localStorage.getItem(REFRESH_KEY)
    : null
  if (!storedRefresh) throw new Error("No refresh token")

  const data = await api.post<AuthResponse>("/auth/refresh", { refreshToken: storedRefresh })

  setAccessToken(data.accessToken)
  if (data.refreshToken) localStorage.setItem(REFRESH_KEY, data.refreshToken)
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
  if (data.refreshToken) localStorage.setItem(REFRESH_KEY, data.refreshToken)
}

function clearAuth() {
  localStorage.removeItem(USER_KEY)
  localStorage.removeItem(REFRESH_KEY)
  setAccessToken(null)
}
