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
  employeeId?: string | null;
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

/** Which mobile app flow the user belongs to */
export type MobileRole = 'client' | 'employee';

/** Backend staff role enum (mirrors Prisma UserRole) */
export type StaffRole =
  | 'SUPER_ADMIN'
  | 'CLINIC_OWNER'
  | 'RECEPTIONIST'
  | 'ACCOUNTANT'
  | 'EMPLOYEE';

/** Flat "subject:action" string produced by backend flattenPermissions() */
export type CaslPermission = string;

/** Unified user shape used by the mobile auth flow (client + staff). */
export interface AuthUser {
  kind: 'client' | 'staff';
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  avatarUrl: string | null;
  emailVerified: boolean;
  staffRole: StaffRole | null;
  isSuperAdmin: boolean;
  permissions: CaslPermission[];
  organizationId: string | null;
}

/** Split a full name into first/last on the first whitespace. */
export function splitName(name: string): { firstName: string; lastName: string } {
  const trimmed = name.trim();
  if (!trimmed) return { firstName: '', lastName: '' };
  const idx = trimmed.search(/\s+/);
  if (idx === -1) return { firstName: trimmed, lastName: '' };
  return {
    firstName: trimmed.slice(0, idx),
    lastName: trimmed.slice(idx).trim(),
  };
}
