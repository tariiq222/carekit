/**
 * User & Role Types — CareKit Dashboard
 */

import type { SearchableQuery, UserGender } from "./common"

/* ─── Entities ─── */

export type UserRole =
  | "SUPER_ADMIN"
  | "ADMIN"
  | "RECEPTIONIST"
  | "ACCOUNTANT"
  | "EMPLOYEE"
  | "CLIENT"

export interface User {
  id: string
  email: string
  name: string
  phone: string | null
  gender: UserGender | null
  avatarUrl: string | null
  isActive: boolean
  role: UserRole
  customRoleId: string | null
  createdAt: string
  updatedAt: string
}

export interface Role {
  id: string
  name: string
  slug: string
  description: string | null
  isDefault: boolean
  isSystem: boolean
  createdAt: string
  permissions: Permission[]
}

export interface Permission {
  id: string
  module: string
  action: string
}

/* ─── Query ─── */

export interface UserListQuery extends SearchableQuery {
  role?: UserRole
  isActive?: boolean
}

/* ─── DTOs ─── */

export interface CreateUserPayload {
  email: string
  password: string
  name: string
  role: UserRole
  phone?: string
  gender?: UserGender
  customRoleId?: string
}

export interface UpdateUserPayload {
  email?: string
  name?: string
  phone?: string
  gender?: UserGender
  role?: UserRole
  customRoleId?: string | null
}

export interface AssignRolePayload {
  roleId?: string
  roleSlug?: string
}

export interface CreateRolePayload {
  name: string
  slug?: string
  description?: string
}

export interface AssignPermissionPayload {
  module: string
  action: string
}
