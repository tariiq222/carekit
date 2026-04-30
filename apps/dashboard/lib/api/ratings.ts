/**
 * Ratings API — Deqah Dashboard
 * Controller: dashboard/organization-settings/ratings
 */

import { api } from "@/lib/api"
import type { PaginatedResponse } from "@/lib/types/common"

export interface Rating {
  id: string
  bookingId: string
  clientId: string
  employeeId: string
  score: number
  comment?: string
  isPublic: boolean
  createdAt: string
}

export interface SubmitRatingPayload {
  bookingId: string
  clientId: string
  employeeId: string
  score: number
  comment?: string
  isPublic?: boolean
}

export interface ListRatingsQuery {
  page?: number
  limit?: number
  employeeId?: string
  clientId?: string
}

export async function fetchRatings(
  query: ListRatingsQuery = {},
): Promise<PaginatedResponse<Rating>> {
  return api.get<PaginatedResponse<Rating>>(
    "/dashboard/organization-settings/ratings",
    {
      page: query.page,
      limit: query.limit,
      employeeId: query.employeeId,
      clientId: query.clientId,
    },
  )
}

export async function submitRating(
  payload: SubmitRatingPayload,
): Promise<Rating> {
  return api.post<Rating>(
    "/dashboard/organization-settings/ratings",
    payload,
  )
}
