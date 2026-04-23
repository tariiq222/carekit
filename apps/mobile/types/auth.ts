/**
 * Auth types — matches backend UserPayload + AuthResponse exactly
 */

export type UserRole = 'client' | 'employee' | 'super_admin' | 'receptionist' | 'accountant';

export interface UserRoleItem {
  id: string;
  name: string;
  slug: string;
}

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  gender: string | null;
  isActive: boolean;
  emailVerified: boolean;
  createdAt: string;
  roles: UserRoleItem[];
  permissions: string[];
  avatarUrl?: string | null;
  organizationId: string | null;
}

/** Derived primary role from roles[] array */
export function getPrimaryRole(user: User): UserRole {
  if (!user.roles.length) return 'client';
  const slug = user.roles[0].slug;
  return (slug as UserRole) ?? 'client';
}

export interface AuthState {
  token: string | null;
  refreshToken: string | null;
  user: User | null;
  isLoading: boolean;
  organizationId: string | null;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginWithOtpRequest {
  email: string;
}

/** Backend expects field named "code", not "otp" */
export interface VerifyOtpRequest {
  email: string;
  code: string;
}

/** Matches backend AuthResponse exactly */
export interface AuthResponse {
  success: boolean;
  data: {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
    user: User;
  };
}
