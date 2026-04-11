/**
 * Rating Types — CareKit Dashboard
 */

import type { PaginatedQuery } from "./common"

/* ─── Entities ─── */

export interface Rating {
  id: string
  bookingId: string
  stars: number
  comment: string | null
  createdAt: string
  patient?: {
    firstName: string
    lastName: string
  } | null
}

/* ─── Query ─── */

export type RatingListQuery = PaginatedQuery

/* ─── DTOs ─── */

export interface CreateRatingPayload {
  bookingId: string
  stars: number
  comment?: string
}
