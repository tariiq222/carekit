/**
 * API Client — CareKit Dashboard
 *
 * Fetch wrapper with auth token injection, error handling,
 * auto 401 refresh, and consistent response parsing.
 *
 * Refresh tokens are stored in httpOnly cookies (set by backend).
 * Only the short-lived accessToken is kept in memory.
 */

import type { ApiResponse, PaginatedResponse } from "@/lib/types/common"

export type { ApiResponse, PaginatedResponse }

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5100/api/v1"

// Same-origin proxy for cookie-bearing auth endpoints (avoids cross-port cookie rejection)
const PROXY_BASE_URL = "/api/proxy"

// Auth endpoints that carry httpOnly cookies — must go through same-origin proxy
const COOKIE_ENDPOINTS = ["/auth/login", "/auth/logout", "/auth/refresh"]

function resolveUrl(endpoint: string): string {
  if (typeof window !== "undefined" && COOKIE_ENDPOINTS.some((p) => endpoint.startsWith(p))) {
    return `${PROXY_BASE_URL}${endpoint}`
  }
  return `${API_BASE_URL}${endpoint}`
}

/* ─── Token Management (in-memory only) ─── */

let accessToken: string | null = null
let refreshPromise: Promise<void> | null = null

export function setAccessToken(token: string | null) {
  accessToken = token
}

export function getAccessToken(): string | null {
  return accessToken
}

/* ─── Core Fetch ─── */

class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message)
    this.name = "ApiError"
  }
}

export { ApiError }

async function tryRefreshToken(): Promise<boolean> {
  if (typeof window === "undefined") return false

  const storedRefresh = localStorage.getItem("carekit_refresh_token")
  if (!storedRefresh) return false

  try {
    const res = await fetch(resolveUrl("/auth/refresh"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ refreshToken: storedRefresh }),
      credentials: "include",
    })
    if (!res.ok) return false

    const body = await res.json()
    const data = body.data ?? body
    setAccessToken(data.accessToken)
    if (data.refreshToken) localStorage.setItem("carekit_refresh_token", data.refreshToken)
    return true
  } catch {
    return false
  }
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {},
  isRetry = false,
): Promise<T> {
  const token = getAccessToken()

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  }

  const res = await fetch(resolveUrl(endpoint), {
    ...options,
    headers,
    credentials: "include",
  })

  /* ─── 401 Auto-Refresh ─── */
  if (res.status === 401 && !isRetry) {
    if (!refreshPromise) {
      refreshPromise = tryRefreshToken()
        .then((ok) => {
          if (!ok) {
            accessToken = null
            if (typeof window !== "undefined") {
              localStorage.removeItem("carekit_user")
            }
            throw new ApiError(401, "UNAUTHORIZED", "Session expired")
          }
        })
        .finally(() => {
          // Always clear the promise — whether success or failure —
          // so the next 401 can trigger a fresh refresh attempt
          refreshPromise = null
        })
    }
    await refreshPromise
    return request<T>(endpoint, options, true)
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    // NestJS returns: { statusCode, message, error: string }
    // Our custom exceptions return: { statusCode, message, error: string (code) }
    // Custom conflicts return { statusCode, message: { error, message } }
    // NestJS default returns { statusCode, message: string | string[], error: string }
    const nestedError =
      body?.message && typeof body.message === "object" && !Array.isArray(body.message)
        ? body.message
        : null
    const code = nestedError?.error ?? body?.error?.code ?? body?.error ?? "UNKNOWN"
    const rawMessage = nestedError?.message ?? body?.message
    const message = Array.isArray(rawMessage)
      ? rawMessage.join(", ")
      : (rawMessage ?? res.statusText)
    throw new ApiError(res.status, code, message)
  }

  if (res.status === 204 || res.headers?.get("content-length") === "0") {
    return undefined as T
  }

  const body = await res.json()

  // Auto-unwrap ApiResponse envelope { success, data } from backend interceptor
  if (body && typeof body === "object" && "success" in body && "data" in body) {
    return body.data as T
  }

  return body as T
}

/* ─── HTTP Methods ─── */

type QueryParams = Record<string, string | number | boolean | undefined>

export const api = {
  get<T>(endpoint: string, params?: QueryParams): Promise<T> {
    const url = params ? `${endpoint}?${buildQuery(params)}` : endpoint
    return request<T>(url)
  },

  post<T>(endpoint: string, body?: unknown): Promise<T> {
    return request<T>(endpoint, { method: "POST", body: JSON.stringify(body) })
  },

  put<T>(endpoint: string, body?: unknown): Promise<T> {
    return request<T>(endpoint, { method: "PUT", body: JSON.stringify(body) })
  },

  patch<T>(endpoint: string, body?: unknown): Promise<T> {
    return request<T>(endpoint, { method: "PATCH", body: JSON.stringify(body) })
  },

  delete<T>(endpoint: string, options?: { data?: unknown }): Promise<T> {
    return request<T>(endpoint, {
      method: "DELETE",
      ...(options?.data !== undefined ? { body: JSON.stringify(options.data) } : {}),
    })
  },
}

/* ─── Helpers ─── */

function buildQuery(params: QueryParams): string {
  const entries = Object.entries(params).filter(
    ([, v]) => v !== undefined && v !== "",
  )
  return new URLSearchParams(
    entries.map(([k, v]) => [k, String(v)]),
  ).toString()
}
