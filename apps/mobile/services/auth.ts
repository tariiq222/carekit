import type { AxiosError } from 'axios';

import api from './api';
import {
  loginClient,
  registerClient,
  refreshClient,
  logoutClient,
  fetchClientProfile,
} from './auth/client-auth';
import {
  loginStaff,
  refreshStaff,
  logoutStaff,
  fetchStaffProfile,
} from './auth/staff-auth';
import {
  getSecureItem,
  setSecureItem,
  deleteSecureItem,
} from '@/stores/secure-storage';
import { store } from '@/stores/store';
import { logout as logoutAction } from '@/stores/slices/auth-slice';
import { clearBranding } from '@/stores/slices/branding-slice';
import type {
  AuthUser,
  LoginRequest,
  OtpRequest,
  OtpVerifyRequest,
  RegisterRequest,
  UserKind,
} from '@/types/auth';

const KIND_KEY = 'userKind';
const ACCESS_KEY = 'accessToken';
const REFRESH_KEY = 'refreshToken';

export interface LoginResult {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
}

export const authService = {
  /**
   * Auto-detect login: try client endpoint first, then staff endpoint on 401.
   * Persists tokens + user kind, fetches full profile, and returns it.
   */
  async login({ email, password }: LoginRequest): Promise<LoginResult> {
    // Try client flow first — the mobile app's primary audience.
    try {
      const client = await loginClient(email, password);
      await persistSession('client', client.accessToken, client.refreshToken);
      const user = await fetchClientProfile();
      return { user, accessToken: client.accessToken, refreshToken: client.refreshToken };
    } catch (err) {
      const status = (err as AxiosError)?.response?.status;
      if (status !== 401 && status !== 400 && status !== 404) throw err;
    }

    // Fallback: staff login (employees, receptionists, admins).
    const staff = await loginStaff(email, password);
    await persistSession('staff', staff.accessToken, staff.refreshToken);
    return { user: staff.user, accessToken: staff.accessToken, refreshToken: staff.refreshToken };
  },

  /** Complete client registration after OTP verification. Staff cannot self-register. */
  async register({ name, password, otpSessionToken }: RegisterRequest): Promise<LoginResult> {
    const client = await registerClient(name, password, otpSessionToken);
    await persistSession('client', client.accessToken, client.refreshToken);
    const user = await fetchClientProfile();
    return { user, accessToken: client.accessToken, refreshToken: client.refreshToken };
  },

  /** POST /public/otp/request — rate-limited to 5/identifier/hour on the backend. */
  async sendOtp(dto: OtpRequest & { hCaptchaToken?: string }): Promise<{ success: boolean }> {
    const res = await api.post<{ success: boolean }>('/public/otp/request', {
      ...dto,
      // Backend captcha verifier defaults to noop in dev; production must wire a real token.
      hCaptchaToken: dto.hCaptchaToken ?? 'mobile-dev',
    });
    return res.data;
  },

  /** POST /public/otp/verify — returns a sessionToken used as Bearer for register/reset. */
  async verifyOtp(dto: OtpVerifyRequest): Promise<{ sessionToken: string }> {
    const res = await api.post<{ sessionToken: string }>('/public/otp/verify', dto);
    return res.data;
  },

  /** Revoke refresh token on the correct audience endpoint + clear local state. */
  async logout(): Promise<void> {
    const kind = await getStoredKind();
    const refreshToken = await getSecureItem(REFRESH_KEY);
    try {
      if (refreshToken) {
        if (kind === 'staff') await logoutStaff(refreshToken);
        else await logoutClient(refreshToken);
      }
    } catch {
      // Swallow — always clear local state below.
    }
    await clearSession();
    store.dispatch(logoutAction());
    store.dispatch(clearBranding());
  },

  /** Hydrate the authenticated user from stored tokens on app start. */
  async hydrate(): Promise<AuthUser | null> {
    const kind = await getStoredKind();
    const accessToken = await getSecureItem(ACCESS_KEY);
    if (!kind || !accessToken) return null;
    try {
      return kind === 'staff' ? await fetchStaffProfile() : await fetchClientProfile();
    } catch {
      return null;
    }
  },

  async getStoredTokens(): Promise<{ accessToken: string | null; refreshToken: string | null; kind: UserKind | null }> {
    const [accessToken, refreshToken, kind] = await Promise.all([
      getSecureItem(ACCESS_KEY),
      getSecureItem(REFRESH_KEY),
      getStoredKind(),
    ]);
    return { accessToken, refreshToken, kind };
  },

  /** Kind-aware refresh used by the axios interceptor. */
  async refresh(refreshToken: string, kind: UserKind): Promise<{ accessToken: string; refreshToken: string }> {
    const rotated = kind === 'staff' ? await refreshStaff(refreshToken) : await refreshClient(refreshToken);
    await setSecureItem(ACCESS_KEY, rotated.accessToken);
    await setSecureItem(REFRESH_KEY, rotated.refreshToken);
    return rotated;
  },
};

async function persistSession(kind: UserKind, accessToken: string, refreshToken: string): Promise<void> {
  await Promise.all([
    setSecureItem(ACCESS_KEY, accessToken),
    setSecureItem(REFRESH_KEY, refreshToken),
    setSecureItem(KIND_KEY, kind),
  ]);
}

async function clearSession(): Promise<void> {
  await Promise.all([
    deleteSecureItem(ACCESS_KEY),
    deleteSecureItem(REFRESH_KEY),
    deleteSecureItem(KIND_KEY),
  ]);
}

async function getStoredKind(): Promise<UserKind | null> {
  const value = await getSecureItem(KIND_KEY);
  return value === 'client' || value === 'staff' ? value : null;
}
