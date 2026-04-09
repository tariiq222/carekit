import { api } from "@/lib/api"
import type {
  Department,
  DepartmentListQuery,
  CreateDepartmentPayload,
  UpdateDepartmentPayload,
} from "@/lib/types/department"
import type { PaginatedResponse } from "@/lib/types/common"

export async function fetchDepartments(
  query: DepartmentListQuery = {},
): Promise<PaginatedResponse<Department>> {
  return api.get("/departments", query as Record<string, string | number | boolean | undefined>)
}

export async function fetchDepartment(id: string): Promise<Department> {
  return api.get(`/departments/${id}`)
}

export async function createDepartment(
  payload: CreateDepartmentPayload,
): Promise<Department> {
  return api.post("/departments", payload)
}

export async function updateDepartment(
  id: string,
  payload: UpdateDepartmentPayload,
): Promise<Department> {
  return api.patch(`/departments/${id}`, payload)
}

export async function deleteDepartment(id: string): Promise<void> {
  return api.delete(`/departments/${id}`)
}
