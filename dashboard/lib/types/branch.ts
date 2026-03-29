/**
 * Branch Types — CareKit Dashboard
 */

import type { PaginatedQuery } from "./common"

/* ─── Entities ─── */

export interface Branch {
  id: string
  nameAr: string
  nameEn: string
  address: string | null
  phone: string | null
  email: string | null
  isMain: boolean
  isActive: boolean
  timezone: string
  createdAt: string
  updatedAt: string
}

export interface PractitionerBranch {
  id: string
  practitionerId: string
  branchId: string
  isPrimary: boolean
  createdAt: string
  updatedAt: string
  practitioner: {
    id: string
    rating: number
    isActive: boolean
    user: { id: string; firstName: string; lastName: string; email: string }
    specialty: string
    specialtyAr: string | null
  }
}

/* ─── Query ─── */

export interface BranchListQuery extends PaginatedQuery {
  search?: string
  isActive?: boolean
}

/* ─── DTOs ─── */

export interface CreateBranchPayload {
  nameAr: string
  nameEn: string
  address?: string
  phone?: string
  email?: string
  isMain?: boolean
  isActive?: boolean
  timezone?: string
}

export interface UpdateBranchPayload {
  nameAr?: string
  nameEn?: string
  address?: string
  phone?: string
  email?: string
  isMain?: boolean
  isActive?: boolean
  timezone?: string
}
