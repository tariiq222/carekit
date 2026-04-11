/**
 * Coupons API — CareKit Dashboard
 */

import { api } from "@/lib/api"
import type { PaginatedResponse } from "@/lib/types/common"
import type {
  Coupon,
  CouponListQuery,
  CreateCouponPayload,
  UpdateCouponPayload,
} from "@/lib/types/coupon"

/* ─── List ─── */

export async function fetchCoupons(
  query: CouponListQuery = {},
): Promise<PaginatedResponse<Coupon>> {
  return api.get<PaginatedResponse<Coupon>>("/coupons", {
    page: query.page,
    perPage: query.perPage,
    search: query.search,
    status: query.status,
  })
}

/* ─── Detail ─── */

export async function fetchCoupon(id: string): Promise<Coupon> {
  return api.get<Coupon>(`/coupons/${id}`)
}

/* ─── Create ─── */

export async function createCoupon(
  payload: CreateCouponPayload,
): Promise<Coupon> {
  return api.post<Coupon>("/coupons", payload)
}

/* ─── Update ─── */

export async function updateCoupon(
  id: string,
  payload: UpdateCouponPayload,
): Promise<Coupon> {
  return api.patch<Coupon>(`/coupons/${id}`, payload)
}

/* ─── Delete ─── */

export async function deleteCoupon(id: string): Promise<void> {
  await api.delete(`/coupons/${id}`)
}
