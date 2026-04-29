// Canonical user payload returned by POST /auth/login and GET /auth/me.
// Fields here MUST match backend src/api/public/auth.controller.ts
// (loginEndpoint and meEndpoint shape after flattenPermissions).
export interface UserPayload {
  id: string
  email: string
  name: string
  // Derived from `name` by the backend (split on first whitespace run).
  // Optional only to tolerate legacy tokens that pre-date the SaaS-04
  // alignment; new responses always include them.
  firstName?: string
  lastName?: string
  phone: string | null
  gender: string | null
  avatarUrl: string | null
  isActive: boolean
  role: string
  customRoleId: string | null
  isSuperAdmin: boolean
  permissions: string[]
  // Resolved from the user's active Membership. Null when the user has
  // no active membership yet (e.g. freshly created super-admin in seeds).
  organizationId: string | null
  // Vertical slug of the active membership's organization (e.g. 'clinic',
  // 'salon'). Powers useTerminology() in dashboard/mobile without a second
  // round-trip. Null when the org has no vertical assigned yet.
  verticalSlug: string | null
  // ISO timestamp when the org's owner finished the onboarding wizard.
  // Null until completed; the dashboard layout uses it to redirect new
  // tenants to /onboarding.
  onboardingCompletedAt: string | null
  createdAt?: string
  updatedAt?: string
}

export interface TokenPair {
  accessToken: string
  refreshToken: string
  expiresIn: number
}

export interface AuthResponse extends TokenPair {
  user: UserPayload
}

export interface ChangePasswordPayload {
  currentPassword: string
  newPassword: string
}
