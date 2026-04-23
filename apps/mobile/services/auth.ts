import api from './api';
import {
  getSecureItem,
  setSecureItem,
  deleteSecureItem,
} from '@/stores/secure-storage';
import { store } from '@/stores/store';
import { logout as logoutAction } from '@/stores/slices/auth-slice';
import { clearBranding } from '@/stores/slices/branding-slice';
import type {
  LoginRequest,
  LoginWithOtpRequest,
  VerifyOtpRequest,
  AuthResponse,
  User,
} from '@/types/auth';
import type { ApiResponse } from '@/types/api';

interface RegisterRequest {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phone?: string;
}

export const authService = {
  async login(data: LoginRequest): Promise<AuthResponse> {
    const response = await api.post<AuthResponse>('/auth/login', data);
    if (response.data.success && response.data.data) {
      await persistTokens(response.data.data);
    }
    return response.data;
  },

  async register(data: RegisterRequest): Promise<AuthResponse> {
    const response = await api.post<AuthResponse>('/auth/register', data);
    if (response.data.success && response.data.data) {
      await persistTokens(response.data.data);
    }
    return response.data;
  },

  /** POST /auth/login/otp/send */
  async sendOtp(data: LoginWithOtpRequest): Promise<ApiResponse> {
    const response = await api.post<ApiResponse>(
      '/auth/login/otp/send',
      data,
    );
    return response.data;
  },

  /** POST /auth/login/otp/verify — field is "code" not "otp" */
  async verifyOtp(data: VerifyOtpRequest): Promise<AuthResponse> {
    const response = await api.post<AuthResponse>(
      '/auth/login/otp/verify',
      data,
    );
    if (response.data.success && response.data.data) {
      await persistTokens(response.data.data);
    }
    return response.data;
  },

  /** Logout: call backend + clear storage + clear Redux */
  async logout(): Promise<void> {
    try {
      const refreshToken = await getSecureItem('refreshToken');
      if (refreshToken) {
        await api.post('/auth/logout', { refreshToken });
      }
    } catch {
      // Backend call may fail — still clear local state
    }
    await deleteSecureItem('accessToken');
    await deleteSecureItem('refreshToken');
    store.dispatch(logoutAction());
    store.dispatch(clearBranding());
  },

  /** GET /auth/me */
  async getProfile(): Promise<ApiResponse<User>> {
    const response = await api.get<ApiResponse<User>>('/auth/me');
    return response.data;
  },

  /** POST /auth/email/verify/send */
  async sendVerificationEmail(): Promise<ApiResponse> {
    const response = await api.post<ApiResponse>('/auth/email/verify/send');
    return response.data;
  },

  /** Hydrate: read tokens from storage for app restart */
  async getStoredTokens() {
    const accessToken = await getSecureItem('accessToken');
    const refreshToken = await getSecureItem('refreshToken');
    return { accessToken, refreshToken };
  },
};

async function persistTokens(data: NonNullable<AuthResponse['data']>) {
  await setSecureItem('accessToken', data.accessToken);
  await setSecureItem('refreshToken', data.refreshToken);
}
