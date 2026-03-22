import api from './api';
import * as SecureStore from 'expo-secure-store';
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

  /** Logout: call backend + clear SecureStore + clear Redux */
  async logout(): Promise<void> {
    try {
      const refreshToken = await SecureStore.getItemAsync('refreshToken');
      if (refreshToken) {
        await api.post('/auth/logout', { refreshToken });
      }
    } catch {
      // Backend call may fail — still clear local state
    }
    await SecureStore.deleteItemAsync('accessToken');
    await SecureStore.deleteItemAsync('refreshToken');
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

  /** Hydrate: read tokens from SecureStore for app restart */
  async getStoredTokens() {
    const accessToken = await SecureStore.getItemAsync('accessToken');
    const refreshToken = await SecureStore.getItemAsync('refreshToken');
    return { accessToken, refreshToken };
  },
};

async function persistTokens(data: AuthResponse['data']) {
  await SecureStore.setItemAsync('accessToken', data.accessToken);
  await SecureStore.setItemAsync('refreshToken', data.refreshToken);
}
