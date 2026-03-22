import axios, {
  type AxiosError,
  type InternalAxiosRequestConfig,
} from 'axios';
import * as SecureStore from 'expo-secure-store';

import { API_URL } from '@/constants/config';
import type { ApiResponse } from '@/types/api';
import { store } from '@/stores/store';
import { logout } from '@/stores/slices/auth-slice';

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
    const token = await SecureStore.getItemAsync('accessToken');
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

    // Handle 401 — attempt token refresh
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = await SecureStore.getItemAsync('refreshToken');
        if (!refreshToken) {
          return Promise.reject(error);
        }

        const { data } = await axios.post<
          ApiResponse<{ accessToken: string; refreshToken: string }>
        >(`${API_URL}/auth/refresh`, { refreshToken });

        if (data.success && data.data) {
          await SecureStore.setItemAsync(
            'accessToken',
            data.data.accessToken,
          );
          await SecureStore.setItemAsync(
            'refreshToken',
            data.data.refreshToken,
          );

          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${data.data.accessToken}`;
          }
          return api(originalRequest);
        }
      } catch {
        // Refresh failed — clear tokens + Redux state
        await SecureStore.deleteItemAsync('accessToken');
        await SecureStore.deleteItemAsync('refreshToken');
        store.dispatch(logout());
      }
    }

    return Promise.reject(error);
  },
);

export default api;
