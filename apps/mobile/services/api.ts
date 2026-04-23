import axios, {
  type AxiosError,
  type InternalAxiosRequestConfig,
} from 'axios';
import { router } from 'expo-router';

import { API_URL } from '@/constants/config';
import type { ApiResponse } from '@/types/api';
import type { UserKind } from '@/types/auth';
import { store } from '@/stores/store';
import { logout } from '@/stores/slices/auth-slice';
import {
  getSecureItem,
  setSecureItem,
  deleteSecureItem,
} from '@/stores/secure-storage';

const ORG_SUSPENDED_CODE = 'ORG_SUSPENDED';
const ACCESS_KEY = 'accessToken';
const REFRESH_KEY = 'refreshToken';
const KIND_KEY = 'userKind';

const api = axios.create({
  baseURL: API_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: inject JWT token
api.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const token = await getSecureItem(ACCESS_KEY);
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  },
);

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
      await Promise.all([
        deleteSecureItem(ACCESS_KEY),
        deleteSecureItem(REFRESH_KEY),
        deleteSecureItem(KIND_KEY),
      ]);
      store.dispatch(logout());
      router.replace('/(auth)/suspended');
      return Promise.reject(error);
    }

    // Handle 401 — attempt token refresh on the audience endpoint (client vs staff).
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const [refreshToken, kindRaw] = await Promise.all([
          getSecureItem(REFRESH_KEY),
          getSecureItem(KIND_KEY),
        ]);
        const kind: UserKind | null =
          kindRaw === 'client' || kindRaw === 'staff' ? kindRaw : null;

        if (!refreshToken || !kind) {
          return Promise.reject(error);
        }

        const refreshPath = kind === 'staff' ? '/auth/refresh' : '/public/auth/refresh';
        const { data } = await axios.post<{ accessToken: string; refreshToken: string }>(
          `${API_URL}${refreshPath}`,
          { refreshToken },
        );

        if (data?.accessToken && data?.refreshToken) {
          await setSecureItem(ACCESS_KEY, data.accessToken);
          await setSecureItem(REFRESH_KEY, data.refreshToken);

          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
          }
          return api(originalRequest);
        }
      } catch {
        // Refresh failed — clear tokens + Redux state
        await Promise.all([
          deleteSecureItem(ACCESS_KEY),
          deleteSecureItem(REFRESH_KEY),
          deleteSecureItem(KIND_KEY),
        ]);
        store.dispatch(logout());
      }
    }

    return Promise.reject(error);
  },
);

export default api;
