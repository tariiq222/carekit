import type { PaginatedResponse, PaginationParams } from './api.js'

export type GiftCardStatusFilter = 'active' | 'inactive' | 'expired' | 'depleted'

export interface GiftCardTransaction {
  id: string
  giftCardId: string
  amount: number
  bookingId: string | null
  note: string | null
  createdAt: string
}

export interface GiftCardListItem {
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

export interface GiftCardListQuery extends PaginationParams {
  status?: GiftCardStatusFilter
}

export interface CreateGiftCardPayload {
  code?: string
  initialAmount: number
  expiresAt?: string
  isActive?: boolean
}

export interface UpdateGiftCardPayload {
  expiresAt?: string
  isActive?: boolean
  purchasedBy?: string
  redeemedBy?: string
}

export type GiftCardListResponse = PaginatedResponse<GiftCardListItem>

export interface GiftCardStats {
  total: number
  active: number
  expired: number
  depleted: number
}
