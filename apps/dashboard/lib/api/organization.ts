/**
 * Clinic API — CareKit Dashboard
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

export async function fetchOrganizationHours(): Promise<OrganizationHour[]> {
  return api.get<OrganizationHour[]>("/organization/hours")
}

export async function updateOrganizationHours(
  hours: Omit<OrganizationHour, "id">[],
): Promise<OrganizationHour[]> {
  return api.put<OrganizationHour[]>("/organization/hours", {
    hours,
  })
}

/* ─── Holidays ─── */

export async function fetchOrganizationHolidays(
  year?: number,
): Promise<OrganizationHoliday[]> {
  const params = year ? { year } : undefined
  return api.get<OrganizationHoliday[]>(
    "/organization/holidays",
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
    "/organization/holidays",
    data,
  )
}

export async function deleteOrganizationHoliday(id: string): Promise<void> {
  await api.delete(`/organization/holidays/${id}`)
}
