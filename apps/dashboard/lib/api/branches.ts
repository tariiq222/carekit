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
} from "@/lib/types/branch"

/* ─── List ─── */

export async function fetchBranches(
  query: BranchListQuery = {},
): Promise<PaginatedResponse<Branch>> {
  return api.get<PaginatedResponse<Branch>>("/dashboard/organization/branches", {
    page: query.page,
    limit: query.perPage,
    isActive: query.isActive,
  })
}

/* ─── Detail ─── */

export async function fetchBranch(id: string): Promise<Branch> {
  return api.get<Branch>(`/dashboard/organization/branches/${id}`)
}

/* ─── Create ─── */

export async function createBranch(
  payload: CreateBranchPayload,
): Promise<Branch> {
  return api.post<Branch>("/dashboard/organization/branches", payload)
}

/* ─── Update ─── */

export async function updateBranch(
  id: string,
  payload: UpdateBranchPayload,
): Promise<Branch> {
  return api.patch<Branch>(`/dashboard/organization/branches/${id}`, payload)
}

