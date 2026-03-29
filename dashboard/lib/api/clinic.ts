/**
 * Clinic API — CareKit Dashboard
 *
 * Working hours and holidays management.
 */

import { api } from "@/lib/api"

/* ─── Types ─── */

export interface ClinicHour {
  id?: string
  dayOfWeek: number
  startTime: string
  endTime: string
  isActive: boolean
}

export interface ClinicHoliday {
  id: string
  date: string
  nameAr: string
  nameEn: string
  isRecurring: boolean
  createdAt: string
}

/* ─── Working Hours ─── */

export async function fetchClinicHours(): Promise<ClinicHour[]> {
  return api.get<ClinicHour[]>("/clinic/hours")
}

export async function updateClinicHours(
  hours: Omit<ClinicHour, "id">[],
): Promise<ClinicHour[]> {
  return api.put<ClinicHour[]>("/clinic/hours", {
    hours,
  })
}

/* ─── Holidays ─── */

export async function fetchClinicHolidays(
  year?: number,
): Promise<ClinicHoliday[]> {
  const params = year ? { year } : undefined
  return api.get<ClinicHoliday[]>(
    "/clinic/holidays",
    params,
  )
}

export async function createClinicHoliday(data: {
  date: string
  nameAr: string
  nameEn: string
  isRecurring?: boolean
}): Promise<ClinicHoliday> {
  return api.post<ClinicHoliday>(
    "/clinic/holidays",
    data,
  )
}

export async function deleteClinicHoliday(id: string): Promise<void> {
  await api.delete(`/clinic/holidays/${id}`)
}
