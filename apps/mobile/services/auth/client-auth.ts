import type { AxiosError } from 'axios';

import api from '../api';
import type { AuthUser } from '@/types/auth';
import { splitName } from '@/types/auth';

export interface ClientLoginResponse {
  accessToken: string;
  refreshToken: string;
  clientId: string;
}

export interface ClientProfileResponse {
  id: string;
  name: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  emailVerified: string | null;
  phoneVerified: string | null;
  avatarUrl: string | null;
  accountType: 'FULL' | 'WALK_IN';
  claimedAt: string | null;
  createdAt: string;
  organizationId: string | null;
}

/** POST /public/auth/login — returns minimal tokens + clientId (no user). */
export async function loginClient(email: string, password: string): Promise<ClientLoginResponse> {
  const res = await api.post<ClientLoginResponse>('/public/auth/login', { email, password });
  return res.data;
}

/** POST /public/auth/register — requires OTP session token from /public/otp/verify. */
export async function registerClient(
  name: string,
  password: string,
  otpSessionToken: string,
): Promise<ClientLoginResponse> {
  const res = await api.post<ClientLoginResponse>(
    '/public/auth/register',
    { name, password },
    { headers: { Authorization: `Bearer ${otpSessionToken}` } },
  );
  return res.data;
}

/** POST /public/auth/refresh — rotates client token pair. */
export async function refreshClient(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
  const res = await api.post<{ accessToken: string; refreshToken: string }>(
    '/public/auth/refresh',
    { refreshToken },
  );
  return res.data;
}

/** POST /public/auth/logout — revokes the refresh token. */
export async function logoutClient(refreshToken: string): Promise<void> {
  try {
    await api.post('/public/auth/logout', { refreshToken });
  } catch (err) {
    // Best-effort; backend may have already invalidated the session.
    const status = (err as AxiosError)?.response?.status;
    if (status !== 401 && status !== 404) throw err;
  }
}

/** GET /mobile/client/profile — fetches the authenticated client's profile. */
export async function fetchClientProfile(): Promise<AuthUser> {
  const res = await api.get<ClientProfileResponse>('/mobile/client/profile');
  const p = res.data;
  const fallback = splitName(p.name);
  return {
    kind: 'client',
    id: p.id,
    name: p.name,
    firstName: p.firstName ?? fallback.firstName,
    lastName: p.lastName ?? fallback.lastName,
    email: p.email,
    phone: p.phone,
    avatarUrl: p.avatarUrl ?? null,
    emailVerified: p.emailVerified !== null,
    staffRole: null,
    isSuperAdmin: false,
    permissions: [],
    organizationId: p.organizationId ?? null,
  };
}
