import axios, {
  type AxiosError,
  type InternalAxiosRequestConfig,
} from 'axios';
import { router } from 'expo-router';

import { API_URL } from '@/constants/config';
import type { ApiResponse } from '@/types/api';
import { store } from '@/stores/store';
import { logout } from '@/stores/slices/auth-slice';
import {
  getSecureItem,
  setSecureItem,
  deleteSecureItem,
} from '@/stores/secure-storage';
import { clearCurrentOrgId, getCurrentOrgIdSync } from './tenant';

const ORG_SUSPENDED_CODE = 'ORG_SUSPENDED';

const api = axios.create({
  baseURL: API_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Tenant header: every request — public and authenticated. On authenticated
// routes the backend's TenantResolverMiddleware ignores this header (JWT
// claim wins); on public routes it scopes catalog data to the active tenant.
// Reads from secure-store cache (hydrated at boot via loadCurrentOrgId),
// falling back to the build-time default for first-launch / pre-login state.
api.interceptors.request.use((config) => {
  const orgId = getCurrentOrgIdSync();
  if (config.headers && typeof (config.headers as { set?: unknown }).set === 'function') {
    (config.headers as { set: (k: string, v: string) => void }).set('X-Org-Id', orgId);
  } else if (config.headers) {
    (config.headers as Record<string, string>)['X-Org-Id'] = orgId;
  }
  return config;
});

// Request interceptor: inject JWT token
api.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const token = await getSecureItem('accessToken');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  },
);

// Single in-flight refresh — concurrent 401s share one refresh round-trip
// instead of each consuming the rotated refresh token, which would race and
// make all but the first fail (causing a spurious logout right after login).
let refreshInFlight: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    try {
      const refreshToken = await getSecureItem('refreshToken');
      if (!refreshToken) return null;
      const { data } = await axios.post<
        ApiResponse<{ accessToken: string; refreshToken: string }>
      >(`${API_URL}/auth/refresh`, { refreshToken });
      // Backend returns tokens directly: {accessToken, refreshToken}.
      // Tolerate legacy {success, data} envelope.
      const payload = (data as any)?.data ?? data;
      if (payload?.accessToken && payload?.refreshToken) {
        await setSecureItem('accessToken', payload.accessToken);
        await setSecureItem('refreshToken', payload.refreshToken);
        return payload.accessToken;
      }
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

// Response interceptor: handle token refresh and errors
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiResponse>) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };
    const responseCode =
      error.response?.data?.error ??
      error.response?.data?.message ??
      error.response?.data?.errorCode;

    if (error.response?.status === 401 && responseCode === ORG_SUSPENDED_CODE) {
      await deleteSecureItem('accessToken');
      await deleteSecureItem('refreshToken');
      await clearCurrentOrgId();
      store.dispatch(logout());
      router.replace('/(auth)/suspended');
      return Promise.reject(error);
    }

    // Client-portal endpoints use a SEPARATE auth system (ClientSessionGuard +
    // httpOnly cookie). They reject the admin JWT we hold post-OTP — but that
    // is NOT a sign of token expiry, so we MUST NOT trigger refresh + logout.
    // Just propagate the 401 so the calling query can show empty state.
    const isClientPortal401 =
      error.response?.status === 401 &&
      typeof error.config?.url === 'string' &&
      error.config.url.includes('/mobile/client/');

    if (error.response?.status === 401 && !originalRequest._retry && !isClientPortal401) {
      originalRequest._retry = true;

      try {
        const newAccessToken = await refreshAccessToken();
        if (newAccessToken) {
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
          }
          return api(originalRequest);
        }
      } catch {
        // fall through to logout
      }

      await deleteSecureItem('accessToken');
      await deleteSecureItem('refreshToken');
      await clearCurrentOrgId();
      store.dispatch(logout());
    }

    return Promise.reject(error);
  },
);

export default api;
