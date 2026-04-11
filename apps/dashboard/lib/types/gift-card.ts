/**
 * Gift Card Types — CareKit Dashboard
 */

import type { PaginatedQuery } from "./common"

/* ─── Entities ─── */

export interface GiftCard {
  id: string
  code: string
  initialAmount: number
  balance: number
  purchasedBy: string | null
  redeemedBy: string | null
  expiresAt: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
  transactions?: GiftCardTransaction[]
}

export interface GiftCardTransaction {
  id: string
  giftCardId: string
  amount: number // positive = credit, negative = debit
  bookingId: string | null
  note: string | null
  createdAt: string
}

/* ─── Query ─── */

export interface GiftCardListQuery extends PaginatedQuery {
  search?: string
  status?: "active" | "inactive" | "expired" | "depleted"
}

/* ─── DTOs ─── */

export interface CreateGiftCardPayload {
  code?: string
  initialAmount: number // halalat
  expiresAt?: string
  isActive?: boolean
}

export interface UpdateGiftCardPayload {
  expiresAt?: string
  isActive?: boolean
  purchasedBy?: string
  redeemedBy?: string
}

export interface AddCreditPayload {
  amount: number // halalat
  note?: string
}

export interface CheckBalanceResult {
  balance: number
  isValid: boolean
}
