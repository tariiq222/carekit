/**
 * Employees API — CareKit Dashboard
 */

export * from "./employees-schedule"

import { api } from "@/lib/api"
import type { PaginatedResponse } from "@/lib/types/common"
import type {
  Employee,
  EmployeeListQuery,
  CreateEmployeePayload,
  UpdateEmployeePayload,
  OnboardEmployeePayload,
  OnboardEmployeeResponse,
} from "@/lib/types/employee"

/* ─── Queries ─── */

export async function fetchEmployees(
  query: EmployeeListQuery = {},
): Promise<PaginatedResponse<Employee>> {
  const res = await api.get<PaginatedResponse<RawEmployee>>("/employees", {
    page: query.page,
    perPage: query.perPage,
    sortBy: query.sortBy,
    sortOrder: query.sortOrder,
    search: query.search,
    specialty: query.specialty,
    minRating: query.minRating,
    isActive: query.isActive,
  })
  return {
    items: res.items.map(mapEmployee),
    meta: res.meta,
  }
}

/** Backend returns specialty as plain text fields + rating/reviewCount */
type RawEmployee = Omit<Employee, "averageRating" | "_count"> & {
  rating?: number
  reviewCount?: number
  _count?: Employee["_count"]
  averageRating?: number
  user: Employee["user"] & { avatarUrl?: string | null }
}

function mapEmployee(raw: RawEmployee): Employee {
  return {
    ...raw,
    specialty: raw.specialty ?? "",
    specialtyAr: raw.specialtyAr ?? null,
    avatarUrl: raw.user?.avatarUrl ?? raw.avatarUrl ?? null,
    averageRating: raw.averageRating ?? raw.rating ?? undefined,
    _count: raw._count ?? {
      bookings: 0,
      ratings: raw.reviewCount ?? 0,
    },
  }
}

export async function fetchEmployee(id: string): Promise<Employee> {
  const res = await api.get<RawEmployee>(`/employees/${id}`)
  return mapEmployee(res)
}

/* ─── CRUD ─── */

export async function createEmployee(
  payload: CreateEmployeePayload,
): Promise<Employee> {
  return api.post<Employee>("/employees", payload)
}

export async function onboardEmployee(
  payload: OnboardEmployeePayload,
): Promise<OnboardEmployeeResponse> {
  return api.post<OnboardEmployeeResponse>("/employees/onboard", payload)
}

export async function updateEmployee(
  id: string,
  payload: UpdateEmployeePayload,
): Promise<Employee> {
  return api.patch<Employee>(`/employees/${id}`, payload)
}

export async function deleteEmployee(id: string): Promise<void> {
  await api.delete(`/employees/${id}`)
}
