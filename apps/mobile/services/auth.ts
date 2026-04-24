import api from './api';
import {
  getSecureItem,
  setSecureItem,
  deleteSecureItem,
} from '@/stores/secure-storage';
import { store } from '@/stores/store';
import { logout as logoutAction } from '@/stores/slices/auth-slice';
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

/**
 * Accept either the legacy `{ success, data }` envelope or the current
 * bare `{ accessToken, refreshToken, user, expiresIn? }` backend shape.
 * Callers can continue to read `response.success` / `response.data` uniformly.
 */
function normalizeAuthResponse(raw: unknown): AuthResponse {
  const r = raw as Partial<AuthResponse> & {
    accessToken?: string;
    refreshToken?: string;
    expiresIn?: number;
    user?: User;
  };
  if (r && typeof r === 'object' && 'success' in r && 'data' in r && r.data) {
    return r as AuthResponse;
  }
  if (r && r.accessToken && r.refreshToken && r.user) {
    return {
      success: true,
      data: {
        accessToken: r.accessToken,
        refreshToken: r.refreshToken,
        expiresIn: r.expiresIn ?? 900,
        user: r.user,
      },
    };
  }
  return { success: false, data: undefined as never };
}

export const authService = {
  async login(data: LoginRequest): Promise<AuthResponse> {
    const response = await api.post<unknown>('/auth/login', data);
    const normalized = normalizeAuthResponse(response.data);
    if (normalized.success && normalized.data) {
      await persistTokens(normalized.data);
    }
    return normalized;
  },

  async register(data: RegisterRequest): Promise<AuthResponse> {
    const response = await api.post<unknown>('/auth/register', data);
    const normalized = normalizeAuthResponse(response.data);
    if (normalized.success && normalized.data) {
      await persistTokens(normalized.data);
    }
    return normalized;
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
    const response = await api.post<unknown>(
      '/auth/login/otp/verify',
      data,
    );
    const normalized = normalizeAuthResponse(response.data);
    if (normalized.success && normalized.data) {
      await persistTokens(normalized.data);
    }
    return normalized;
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
