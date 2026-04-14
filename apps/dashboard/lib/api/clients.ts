/**
 * Clients API — CareKit Dashboard
 * Controller: dashboard/people/clients
 */

import { api } from "@/lib/api"
import type { PaginatedResponse } from "@/lib/types/common"
import type {
  Client,
  ClientListQuery,
} from "@/lib/types/client"

export interface CreateClientPayload {
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

export async function fetchClients(
  query: ClientListQuery = {},
): Promise<PaginatedResponse<Client>> {
  return api.get<PaginatedResponse<Client>>("/dashboard/people/clients", {
    page: query.page,
    limit: query.perPage,
    search: query.search,
    ...(query.isActive !== undefined && { isActive: query.isActive }),
  })
}

export async function fetchClient(id: string): Promise<Client> {
  return api.get<Client>(`/dashboard/people/clients/${id}`)
}

export async function createWalkInClient(
  payload: CreateClientPayload,
): Promise<CreateClientResponse> {
  return api.post<CreateClientResponse>("/dashboard/people/clients", payload)
}

export async function updateClient(
  id: string,
  payload: UpdateClientPayload,
): Promise<Client> {
  return api.patch<Client>(`/dashboard/people/clients/${id}`, payload)
}
