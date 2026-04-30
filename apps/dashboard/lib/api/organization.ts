/**
 * Clinic API — Deqah Dashboard
 *
 * Working hours and holidays management.
 */

import { api } from "@/lib/api"

/* ─── Types ─── */

export interface OrganizationHour {
  id?: string
  dayOfWeek: number
  startTime: string
  endTime: string
  isActive: boolean
}

export interface OrganizationHoliday {
  id: string
  date: string
  nameAr: string
  nameEn: string
  isRecurring: boolean
  createdAt: string
}

/* ─── Working Hours ─── */

export async function fetchOrganizationHours(branchId?: string): Promise<OrganizationHour[]> {
  const path = branchId
    ? `/dashboard/organization/hours/${branchId}`
    : `/dashboard/organization/hours`
  return api.get<OrganizationHour[]>(path)
}

export async function updateOrganizationHours(
  hours: Omit<OrganizationHour, "id">[],
): Promise<OrganizationHour[]> {
  return api.post<OrganizationHour[]>("/dashboard/organization/hours", {
    hours,
  })
}

/* ─── Holidays ─── */

export async function fetchOrganizationHolidays(
  year?: number,
): Promise<OrganizationHoliday[]> {
  const params = year ? { year } : undefined
  return api.get<OrganizationHoliday[]>(
    "/dashboard/organization/holidays",
    params,
  )
}

export async function createOrganizationHoliday(data: {
  date: string
  nameAr: string
  nameEn: string
  isRecurring?: boolean
}): Promise<OrganizationHoliday> {
  return api.post<OrganizationHoliday>(
    "/dashboard/organization/holidays",
    data,
  )
}

export async function deleteOrganizationHoliday(id: string): Promise<void> {
  await api.delete(`/dashboard/organization/holidays/${id}`)
}
