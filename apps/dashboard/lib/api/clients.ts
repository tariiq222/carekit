/**
 * Clients API — CareKit Dashboard
 */

import { api } from "@/lib/api"
import type { PaginatedResponse } from "@/lib/types/common"
import type {
  Client,
  ClientStats,
  ClientListQuery,
  ClientBookingPreview,
} from "@/lib/types/client"

type ClientStatsResponse = Partial<ClientStats> & {
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

function normalizeClientStats(stats: ClientStatsResponse): ClientStats {
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

export interface ClientListStats {
  total: number
  active: number
  inactive: number
  newThisMonth: number
}

export async function fetchClients(
  query: ClientListQuery = {}
): Promise<PaginatedResponse<Client>> {
  return api.get<PaginatedResponse<Client>>("/clients", {
    page: query.page,
    perPage: query.perPage,
    search: query.search,
    ...(query.isActive !== undefined && { isActive: query.isActive }),
  })
}

export async function fetchClientListStats(): Promise<ClientListStats> {
  return api.get<ClientListStats>("/clients/list-stats")
}

export async function fetchClient(id: string): Promise<Client> {
  return api.get<Client>(`/clients/${id}`)
}

export async function fetchClientStats(id: string): Promise<ClientStats> {
  const stats = await api.get<ClientStatsResponse>(`/clients/${id}/stats`)
  return normalizeClientStats(stats)
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

export interface CreateClientResponse {
  id: string
  isExisting?: boolean
}

export async function createWalkInClient(
  payload: CreateWalkInPayload
): Promise<CreateClientResponse> {
  return api.post<CreateClientResponse>("/clients/walk-in", payload)
}

export interface UpdateClientPayload {
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

export async function updateClient(
  id: string,
  payload: UpdateClientPayload
): Promise<Client> {
  return api.patch<Client>(`/clients/${id}`, payload)
}

export async function activateClient(id: string): Promise<Client> {
  return api.patch<Client>(`/clients/${id}`, { isActive: true })
}

export async function deactivateClient(id: string): Promise<Client> {
  return api.patch<Client>(`/clients/${id}`, { isActive: false })
}

export async function fetchClientBookings(id: string): Promise<PaginatedResponse<ClientBookingPreview>> {
  return api.get<PaginatedResponse<ClientBookingPreview>>(`/clients/${id}/bookings`)
}
