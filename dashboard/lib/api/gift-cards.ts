/**
 * Gift Cards API — CareKit Dashboard
 */

import { api } from "@/lib/api"
import type { PaginatedResponse } from "@/lib/types/common"
import type {
  GiftCard,
  GiftCardListQuery,
  CreateGiftCardPayload,
  UpdateGiftCardPayload,
  AddCreditPayload,
  CheckBalanceResult,
} from "@/lib/types/gift-card"

/* ─── List ─── */

export async function fetchGiftCards(
  query: GiftCardListQuery = {},
): Promise<PaginatedResponse<GiftCard>> {
  return api.get<PaginatedResponse<GiftCard>>("/gift-cards", {
    page: query.page,
    perPage: query.perPage,
    search: query.search,
    status: query.status,
  })
}

/* ─── Detail ─── */

export async function fetchGiftCard(id: string): Promise<GiftCard> {
  return api.get<GiftCard>(`/gift-cards/${id}`)
}

/* ─── Create ─── */

export async function createGiftCard(
  payload: CreateGiftCardPayload,
): Promise<GiftCard> {
  return api.post<GiftCard>("/gift-cards", payload)
}

/* ─── Update ─── */

export async function updateGiftCard(
  id: string,
  payload: UpdateGiftCardPayload,
): Promise<GiftCard> {
  return api.patch<GiftCard>(`/gift-cards/${id}`, payload)
}

/* ─── Deactivate ─── */

export async function deactivateGiftCard(id: string): Promise<void> {
  await api.delete(`/gift-cards/${id}`)
}

/* ─── Check Balance ─── */

export async function checkGiftCardBalance(
  code: string,
): Promise<CheckBalanceResult> {
  return api.post<CheckBalanceResult>(
    "/gift-cards/check-balance",
    { code },
  )
}

/* ─── Add Credit ─── */

export async function addGiftCardCredit(
  id: string,
  payload: AddCreditPayload,
): Promise<GiftCard> {
  return api.post<GiftCard>(
    `/gift-cards/${id}/credit`,
    payload,
  )
}
