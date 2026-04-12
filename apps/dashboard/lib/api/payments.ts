/**
 * Payments API — CareKit Dashboard
 * Controller: dashboard/finance/payments
 */

import { api } from "@/lib/api"
import type { PaginatedResponse } from "@/lib/types/common"
import type { Payment, PaymentListQuery, PaymentStats } from "@/lib/types/payment"

export async function fetchPaymentStats(): Promise<PaymentStats> {
  return api.get<PaymentStats>("/dashboard/finance/payments/stats")
}

export async function refundPayment(
  id: string,
  payload: { reason: string; amount?: number },
): Promise<Payment> {
  return api.patch<Payment>(`/dashboard/finance/payments/${id}/refund`, payload)
}

export async function verifyPayment(
  id: string,
  payload: { transferRef?: string },
): Promise<Payment> {
  return api.patch<Payment>(`/dashboard/finance/payments/${id}/verify`, payload)
}

export async function fetchPayments(
  query: PaymentListQuery = {},
): Promise<PaginatedResponse<Payment>> {
  return api.get<PaginatedResponse<Payment>>("/dashboard/finance/payments", {
    page: query.page,
    perPage: query.perPage,
    search: query.search,
    status: query.status,
    method: query.method,
    dateFrom: query.dateFrom,
    dateTo: query.dateTo,
  })
}
