/**
 * Coupons API — CareKit Dashboard
 *
 * Backend uses enum PERCENTAGE/FIXED and the column name `minOrderAmt`.
 * The dashboard UI keeps the lowercase "percentage"/"fixed" + `minAmount` shape,
 * so this module maps both directions at the network boundary.
 */

import { api } from "@/lib/api"
import type { PaginatedResponse } from "@/lib/types/common"
import type {
  Coupon,
  CouponListQuery,
  CreateCouponPayload,
  UpdateCouponPayload,
} from "@/lib/types/coupon"

type ApiCoupon = Omit<Coupon, "discountType" | "minAmount"> & {
  discountType: "PERCENTAGE" | "FIXED"
  minOrderAmt: number | null
}

type ApiCreatePayload = Omit<CreateCouponPayload, "discountType" | "minAmount"> & {
  discountType: "PERCENTAGE" | "FIXED"
  minOrderAmt?: number
}

type ApiUpdatePayload = Omit<UpdateCouponPayload, "discountType" | "minAmount"> & {
  discountType?: "PERCENTAGE" | "FIXED"
  minOrderAmt?: number
}

function fromApi(raw: ApiCoupon): Coupon {
  const { discountType, minOrderAmt, ...rest } = raw
  return {
    ...rest,
    discountType: discountType === "PERCENTAGE" ? "percentage" : "fixed",
    minAmount: minOrderAmt ?? 0,
  }
}

function toApiCreate(payload: CreateCouponPayload): ApiCreatePayload {
  const { discountType, minAmount, ...rest } = payload
  return {
    ...rest,
    discountType: discountType === "percentage" ? "PERCENTAGE" : "FIXED",
    ...(minAmount !== undefined ? { minOrderAmt: minAmount } : {}),
  }
}

function toApiUpdate(payload: UpdateCouponPayload): ApiUpdatePayload {
  const { discountType, minAmount, ...rest } = payload
  return {
    ...rest,
    ...(discountType ? { discountType: discountType === "percentage" ? "PERCENTAGE" as const : "FIXED" as const } : {}),
    ...(minAmount !== undefined ? { minOrderAmt: minAmount } : {}),
  }
}

/* ─── List ─── */

export async function fetchCoupons(
  query: CouponListQuery = {},
): Promise<PaginatedResponse<Coupon>> {
  const res = await api.get<PaginatedResponse<ApiCoupon>>("/dashboard/finance/coupons", {
    page: query.page,
    limit: query.perPage,
    search: query.search,
    status: query.status,
  })
  return { ...res, items: res.items.map(fromApi) }
}

/* ─── Detail ─── */

export async function fetchCoupon(id: string): Promise<Coupon> {
  const raw = await api.get<ApiCoupon>(`/dashboard/finance/coupons/${id}`)
  return fromApi(raw)
}

/* ─── Create ─── */

export async function createCoupon(
  payload: CreateCouponPayload,
): Promise<Coupon> {
  const raw = await api.post<ApiCoupon>("/dashboard/finance/coupons", toApiCreate(payload))
  return fromApi(raw)
}

/* ─── Update ─── */

export async function updateCoupon(
  id: string,
  payload: UpdateCouponPayload,
): Promise<Coupon> {
  const raw = await api.patch<ApiCoupon>(`/dashboard/finance/coupons/${id}`, toApiUpdate(payload))
  return fromApi(raw)
}

/* ─── Delete ─── */

export async function deleteCoupon(id: string): Promise<void> {
  await api.delete(`/dashboard/finance/coupons/${id}`)
}
