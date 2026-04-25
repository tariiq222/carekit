// Canonical user payload returned by POST /auth/login and GET /auth/me.
// Fields here MUST match backend src/api/public/auth.controller.ts
// (loginEndpoint and meEndpoint shape after flattenPermissions).
export interface UserPayload {
  id: string
  email: string
  name: string
  phone: string | null
  gender: string | null
  avatarUrl: string | null
  isActive: boolean
  role: string
  customRoleId: string | null
  isSuperAdmin: boolean
  permissions: string[]
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
