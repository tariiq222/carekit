/**
 * Patients API — CareKit Dashboard
 */

import { api } from "@/lib/api"
import type { PaginatedResponse } from "@/lib/types/common"
import type {
  Patient,
  PatientStats,
  PatientListQuery,
  PatientBookingPreview,
} from "@/lib/types/patient"

type PatientStatsResponse = Partial<PatientStats> & {
  totalBookings: number
  byStatus?: Record<string, number>
  totalPaid?: number
  completedPayments?: number
}

function readStatusCount(
  byStatus: Record<string, number> | undefined,
  ...keys: string[]
): number {
  if (!byStatus) return 0
  for (const key of keys) {
    if (typeof byStatus[key] === "number") return byStatus[key]
  }
  return 0
}

function normalizePatientStats(stats: PatientStatsResponse): PatientStats {
  const byStatus = stats.byStatus ?? {}

  return {
    totalBookings: stats.totalBookings,
    completedBookings:
      stats.completedBookings ??
      readStatusCount(byStatus, "completed", "COMPLETED", "done", "DONE"),
    cancelledBookings:
      stats.cancelledBookings ??
      readStatusCount(
        byStatus,
        "cancelled",
        "CANCELLED",
        "canceled",
        "CANCELED"
      ),
    totalSpent: stats.totalSpent ?? stats.totalPaid ?? 0,
    totalPaid: stats.totalPaid ?? stats.totalSpent ?? 0,
    completedPayments: stats.completedPayments,
    lastVisit: stats.lastVisit ?? null,
    byStatus,
  }
}

/* ─── Queries ─── */

export interface PatientListStats {
  total: number
  active: number
  inactive: number
  newThisMonth: number
}

export async function fetchPatients(
  query: PatientListQuery = {}
): Promise<PaginatedResponse<Patient>> {
  return api.get<PaginatedResponse<Patient>>("/patients", {
    page: query.page,
    perPage: query.perPage,
    search: query.search,
    ...(query.isActive !== undefined && { isActive: query.isActive }),
  })
}

export async function fetchPatientListStats(): Promise<PatientListStats> {
  return api.get<PatientListStats>("/patients/list-stats")
}

export async function fetchPatient(id: string): Promise<Patient> {
  return api.get<Patient>(`/patients/${id}`)
}

export async function fetchPatientStats(id: string): Promise<PatientStats> {
  const stats = await api.get<PatientStatsResponse>(`/patients/${id}/stats`)
  return normalizePatientStats(stats)
}

/* ─── Mutations ─── */

export interface CreateWalkInPayload {
  firstName: string
  middleName?: string
  lastName: string
  phone: string
  gender?: "male" | "female"
  dateOfBirth?: string
  nationality?: string
  nationalId?: string
  emergencyName?: string
  emergencyPhone?: string
  bloodType?: string
  allergies?: string
  chronicConditions?: string
}

export interface CreatePatientResponse {
  id: string
  isExisting?: boolean
}

export async function createWalkInPatient(
  payload: CreateWalkInPayload
): Promise<CreatePatientResponse> {
  return api.post<CreatePatientResponse>("/patients/walk-in", payload)
}

export interface UpdatePatientPayload {
  firstName?: string
  middleName?: string
  lastName?: string
  phone?: string
  gender?: "male" | "female"
  dateOfBirth?: string
  nationality?: string
  nationalId?: string
  emergencyName?: string
  emergencyPhone?: string
  bloodType?: string
  allergies?: string
  chronicConditions?: string
  isActive?: boolean
}

export async function updatePatient(
  id: string,
  payload: UpdatePatientPayload
): Promise<Patient> {
  return api.patch<Patient>(`/patients/${id}`, payload)
}

export async function activatePatient(id: string): Promise<Patient> {
  return api.patch<Patient>(`/patients/${id}`, { isActive: true })
}

export async function deactivatePatient(id: string): Promise<Patient> {
  return api.patch<Patient>(`/patients/${id}`, { isActive: false })
}

export async function fetchPatientBookings(id: string): Promise<PaginatedResponse<PatientBookingPreview>> {
  return api.get<PaginatedResponse<PatientBookingPreview>>(`/patients/${id}/bookings`)
}
