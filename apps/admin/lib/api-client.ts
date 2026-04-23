// Admin API client wired to @carekit/api-client.
//
// This module initialises the shared client once at module load using the admin's
// localStorage keys (admin.accessToken / admin.refreshToken) and re-exports the
// same adminRequest / publicRequest surface that feature slices already use so
// no import changes are needed downstream.

export { ApiError } from '@carekit/api-client';

import { initClient, apiRequest, ApiError } from '@carekit/api-client';

// ---------------------------------------------------------------------------
// Token storage keys — must match what the old custom wrapper used
// ---------------------------------------------------------------------------
const ACCESS_KEY = 'admin.accessToken';
const REFRESH_KEY = 'admin.refreshToken';

// ---------------------------------------------------------------------------
// Initialise the shared client once
// ---------------------------------------------------------------------------
initClient({
  baseUrl:
    (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5100/api/v1') + '/admin',

  getAccessToken: () =>
    typeof window !== 'undefined' ? window.localStorage.getItem(ACCESS_KEY) : null,

  getRefreshToken: () =>
    typeof window !== 'undefined' ? window.localStorage.getItem(REFRESH_KEY) : null,

  onTokenRefreshed: (accessToken, refreshToken) => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(ACCESS_KEY, accessToken);
      if (refreshToken) window.localStorage.setItem(REFRESH_KEY, refreshToken);
    }
  },

  onAuthFailure: () => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(ACCESS_KEY);
      window.localStorage.removeItem(REFRESH_KEY);
      document.cookie = 'admin.authenticated=; Max-Age=0; path=/';
      window.location.href = '/login';
    }
  },
});

// ---------------------------------------------------------------------------
// Proxy path prefixes (used by Next.js rewrites in next.config.mjs)
// /api/proxy/admin/*  → backend /api/v1/admin/*
// /api/proxy/*        → backend /api/v1/*  (public routes)
// ---------------------------------------------------------------------------
const ADMIN_BASE = '/api/proxy/admin';
const PUBLIC_BASE = '/api/proxy';

/**
 * Authenticated admin request.
 * The shared apiRequest handles token attachment, 401→refresh→retry and response
 * unwrapping ({ success: true, data } → T) automatically.
 */
export function adminRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  return apiRequest<T>(`${ADMIN_BASE}${path}`, init);
}

/**
 * Public / unauthenticated request.
 * We deliberately bypass the shared client's token getter so that an admin token
 * present in localStorage is never accidentally sent to public endpoints.
 * This is a plain fetch — no 401 refresh needed for public routes.
 */
export async function publicRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers({ 'Content-Type': 'application/json', ...(init.headers as Record<string, string>) });

  const res = await fetch(`${PUBLIC_BASE}${path}`, {
    ...init,
    headers,
    credentials: 'include',
  });

  if (res.status === 204) return undefined as T;

  const json = (await res.json()) as unknown;

  if (!res.ok) {
    const body = json as { message?: string; error?: string };
    throw new ApiError(res.status, body?.message ?? res.statusText, body);
  }

  // Unwrap { success: true, data } when present (same logic as shared client)
  if (json && typeof json === 'object' && 'success' in json && 'data' in json) {
    return (json as { data: T }).data;
  }

  return json as T;
}
