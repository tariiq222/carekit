import api from './api';
import * as SecureStore from 'expo-secure-store';
import type {
  LoginRequest,
  LoginWithOtpRequest,
  VerifyOtpRequest,
  AuthResponse,
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

  async sendOtp(data: LoginWithOtpRequest): Promise<ApiResponse> {
    const response = await api.post<ApiResponse>('/auth/otp/send', data);
    return response.data;
  },

  async verifyOtp(data: VerifyOtpRequest): Promise<AuthResponse> {
    const response = await api.post<AuthResponse>('/auth/otp/verify', data);
    if (response.data.success && response.data.data) {
      await persistTokens(response.data.data);
    }
    return response.data;
  },

  async logout(): Promise<void> {
    await SecureStore.deleteItemAsync('accessToken');
    await SecureStore.deleteItemAsync('refreshToken');
  },

  async getProfile(): Promise<ApiResponse> {
    const response = await api.get<ApiResponse>('/auth/profile');
    return response.data;
  },
};

async function persistTokens(data: AuthResponse['data']) {
  await SecureStore.setItemAsync('accessToken', data.accessToken);
  await SecureStore.setItemAsync('refreshToken', data.refreshToken);
}
