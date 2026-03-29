/**
 * User & Role Types — CareKit Dashboard
 */

import type { SearchableQuery, UserGender } from "./common"

/* ─── Entities ─── */

export interface UserRole {
  id: string
  name: string
  slug: string
}

export interface User {
  id: string
  email: string
  firstName: string
  lastName: string
  phone: string | null
  gender: UserGender | null
  isActive: boolean
  emailVerified: boolean
  createdAt: string
  updatedAt: string
  roles: UserRole[]
}

export interface Role {
  id: string
  name: string
  slug: string
  description: string | null
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
  role?: string
  isActive?: boolean
}

/* ─── DTOs ─── */

export interface CreateUserPayload {
  email: string
  password: string
  firstName: string
  lastName: string
  phone?: string
  gender?: UserGender
  roleSlug: string
}

export interface UpdateUserPayload {
  email?: string
  firstName?: string
  lastName?: string
  phone?: string
  gender?: UserGender
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
