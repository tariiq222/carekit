/**
 * Auth types — aligned with actual backend response shapes.
 *
 * Two distinct flows:
 *  - client → POST /public/auth/login, JWT with namespace=client, profile via GET /mobile/client/profile
 *  - staff  → POST /auth/login,        admin JWT, profile via GET /auth/me
 *
 * Redux stores a unified AuthUser with `kind` to route correctly on refresh/hydrate.
 */

export type UserKind = 'client' | 'staff';

export type StaffRole =
  | 'SUPER_ADMIN'
  | 'ADMIN'
  | 'RECEPTIONIST'
  | 'ACCOUNTANT'
  | 'EMPLOYEE';

export type MobileRole = 'client' | 'employee';

export interface CaslPermission {
  action: string;
  subject: string;
}

export interface AuthUser {
  kind: UserKind;
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

export interface AuthState {
  token: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
  isLoading: boolean;
  organizationId: string | null;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface OtpRequest {
  channel: 'EMAIL' | 'SMS';
  identifier: string;
  purpose: 'GUEST_BOOKING' | 'CLIENT_LOGIN' | 'CLIENT_PASSWORD_RESET';
}

export interface OtpVerifyRequest extends OtpRequest {
  code: string;
}

export interface RegisterRequest {
  name: string;
  password: string;
  /** OTP sessionToken obtained from POST /public/otp/verify. */
  otpSessionToken: string;
}

/**
 * Pick the mobile app area to route to. Any staff role (admin, receptionist,
 * accountant, employee, super_admin) lands in the employee app on mobile —
 * the client app is strictly for end-users.
 */
/**
 * Only route to the employee app when we have an explicit staff kind.
 * Everything else (including legacy persisted users without `kind`) defaults
 * to the client app — a safer fallback than flipping an anonymous user into
 * the staff experience.
 */
export function getMobileRole(user: AuthUser): MobileRole {
  return user.kind === 'staff' ? 'employee' : 'client';
}

export function splitName(name: string): { firstName: string; lastName: string } {
  const trimmed = (name ?? '').trim();
  if (!trimmed) return { firstName: '', lastName: '' };
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}
