/**
 * Users & Roles API — CareKit Dashboard
 */

import { api } from "@/lib/api"
import type { PaginatedResponse } from "@/lib/types/common"
import type {
  User,
  Role,
  Permission,
  UserListQuery,
  CreateUserPayload,
  UpdateUserPayload,
  AssignRolePayload,
  CreateRolePayload,
  AssignPermissionPayload,
} from "@/lib/types/user"

/* ─── Users ─── */

export async function fetchUsers(
  query: UserListQuery = {},
): Promise<PaginatedResponse<User>> {
  return api.get<PaginatedResponse<User>>("/users", {
    page: query.page,
    perPage: query.perPage,
    sortBy: query.sortBy,
    sortOrder: query.sortOrder,
    search: query.search,
    role: query.role,
    isActive: query.isActive,
  })
}

export async function fetchUser(id: string): Promise<User> {
  return api.get<User>(`/users/${id}`)
}

export async function createUser(payload: CreateUserPayload): Promise<User> {
  return api.post<User>("/users", payload)
}

export async function updateUser(
  id: string,
  payload: UpdateUserPayload,
): Promise<User> {
  return api.patch<User>(`/users/${id}`, payload)
}

export async function deleteUser(id: string): Promise<void> {
  await api.delete(`/users/${id}`)
}

export async function activateUser(id: string): Promise<void> {
  await api.patch(`/users/${id}/activate`)
}

export async function deactivateUser(id: string): Promise<void> {
  await api.patch(`/users/${id}/deactivate`)
}

export async function assignRole(
  userId: string,
  payload: AssignRolePayload,
): Promise<void> {
  await api.post(`/users/${userId}/roles`, payload)
}

export async function removeRole(
  userId: string,
  roleId: string,
): Promise<void> {
  await api.delete(`/users/${userId}/roles/${roleId}`)
}

/* ─── Roles ─── */

export async function fetchRoles(): Promise<Role[]> {
  return api.get<Role[]>("/roles")
}

export async function createRole(payload: CreateRolePayload): Promise<Role> {
  return api.post<Role>("/roles", payload)
}

export async function deleteRole(id: string): Promise<void> {
  await api.delete(`/roles/${id}`)
}

export async function assignPermission(
  roleId: string,
  payload: AssignPermissionPayload,
): Promise<void> {
  await api.post(`/roles/${roleId}/permissions`, payload)
}

export async function removePermission(
  roleId: string,
  payload: AssignPermissionPayload,
): Promise<void> {
  await api.delete(`/roles/${roleId}/permissions`, { data: payload })
}

/* ─── Permissions ─── */

export async function fetchPermissions(): Promise<Permission[]> {
  return api.get<Permission[]>("/permissions")
}
