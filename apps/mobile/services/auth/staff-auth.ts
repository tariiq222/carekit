import type { AxiosError } from 'axios';

import api from '../api';
import type { AuthUser, CaslPermission, StaffRole } from '@/types/auth';
import { splitName } from '@/types/auth';

interface StaffUserDto {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  gender: string | null;
  avatarUrl: string | null;
  isActive: boolean;
  role: StaffRole;
  isSuperAdmin: boolean;
  permissions: CaslPermission[];
}

export interface StaffLoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: StaffUserDto;
}

export interface StaffMeResponse extends StaffUserDto {
  firstName?: string;
  lastName?: string;
}

function toAuthUser(dto: StaffUserDto): AuthUser {
  const { firstName, lastName } = splitName(dto.name);
  return {
    kind: 'staff',
    id: dto.id,
    name: dto.name,
    firstName,
    lastName,
    email: dto.email,
    phone: dto.phone,
    avatarUrl: dto.avatarUrl,
    // Staff users don't carry a verification flag in this response — treat as verified.
    emailVerified: true,
    staffRole: dto.role,
    isSuperAdmin: dto.isSuperAdmin,
    permissions: dto.permissions ?? [],
    organizationId: null,
  };
}

/** POST /auth/login — staff/admin login. Returns full user payload. */
export async function loginStaff(
  email: string,
  password: string,
): Promise<{ accessToken: string; refreshToken: string; user: AuthUser }> {
  const res = await api.post<StaffLoginResponse>('/auth/login', { email, password });
  return {
    accessToken: res.data.accessToken,
    refreshToken: res.data.refreshToken,
    user: toAuthUser(res.data.user),
  };
}

/** POST /auth/refresh — rotates the staff token pair. */
export async function refreshStaff(
  refreshToken: string,
): Promise<{ accessToken: string; refreshToken: string }> {
  const res = await api.post<{ accessToken: string; refreshToken: string }>(
    '/auth/refresh',
    { refreshToken },
  );
  return { accessToken: res.data.accessToken, refreshToken: res.data.refreshToken };
}

/** POST /auth/logout — revokes the refresh token. */
export async function logoutStaff(refreshToken: string): Promise<void> {
  try {
    await api.post('/auth/logout', { refreshToken });
  } catch (err) {
    const status = (err as AxiosError)?.response?.status;
    if (status !== 401 && status !== 404) throw err;
  }
}

/** GET /auth/me — returns the authenticated staff user. */
export async function fetchStaffProfile(): Promise<AuthUser> {
  const res = await api.get<StaffMeResponse>('/auth/me');
  return toAuthUser(res.data);
}
