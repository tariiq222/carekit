/**
 * Branches API — CareKit Dashboard
 */

import { api } from "@/lib/api"
import type { PaginatedResponse } from "@/lib/types/common"
import type {
  Branch,
  BranchListQuery,
  CreateBranchPayload,
  UpdateBranchPayload,
  EmployeeBranch,
} from "@/lib/types/branch"

/* ─── List ─── */

export async function fetchBranches(
  query: BranchListQuery = {},
): Promise<PaginatedResponse<Branch>> {
  return api.get<PaginatedResponse<Branch>>("/branches", {
    page: query.page,
    perPage: query.perPage,
    search: query.search,
    isActive: query.isActive,
  })
}

/* ─── Detail ─── */

export async function fetchBranch(id: string): Promise<Branch> {
  return api.get<Branch>(`/branches/${id}`)
}

/* ─── Create ─── */

export async function createBranch(
  payload: CreateBranchPayload,
): Promise<Branch> {
  return api.post<Branch>("/branches", payload)
}

/* ─── Update ─── */

export async function updateBranch(
  id: string,
  payload: UpdateBranchPayload,
): Promise<Branch> {
  return api.patch<Branch>(`/branches/${id}`, payload)
}

/* ─── Delete ─── */

export async function deleteBranch(id: string): Promise<void> {
  await api.delete(`/branches/${id}`)
}

/* ─── Employees ─── */

export async function fetchBranchEmployees(
  branchId: string,
): Promise<EmployeeBranch[]> {
  return api.get<EmployeeBranch[]>(
    `/branches/${branchId}/employees`,
  )
}

export async function assignBranchEmployees(
  branchId: string,
  employeeIds: string[],
): Promise<EmployeeBranch[]> {
  return api.patch<EmployeeBranch[]>(
    `/branches/${branchId}/employees`,
    { employeeIds },
  )
}

export async function removeBranchEmployee(
  branchId: string,
  employeeId: string,
): Promise<void> {
  await api.delete(`/branches/${branchId}/employees/${employeeId}`)
}
