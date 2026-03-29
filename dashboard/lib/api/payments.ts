/**
 * Payments API — CareKit Dashboard
 */

import { api } from "@/lib/api"
import type { PaginatedResponse } from "@/lib/types/common"
import type {
  Payment,
  PaymentStats,
  PaymentListQuery,
  RefundPayload,
  UpdatePaymentStatusPayload,
  VerifyBankTransferPayload,
  ReviewReceiptPayload,
} from "@/lib/types/payment"

/* ─── Queries ─── */

export async function fetchPayments(
  query: PaymentListQuery = {},
): Promise<PaginatedResponse<Payment>> {
  return api.get<PaginatedResponse<Payment>>("/payments", {
    page: query.page,
    perPage: query.perPage,
    search: query.search,
    status: query.status,
    method: query.method,
    dateFrom: query.dateFrom,
    dateTo: query.dateTo,
  })
}

export async function fetchPayment(id: string): Promise<Payment> {
  return api.get<Payment>(`/payments/${id}`)
}

export async function fetchPaymentStats(): Promise<PaymentStats> {
  return api.get<PaymentStats>("/payments/stats")
}

export async function fetchPaymentByBooking(
  bookingId: string,
): Promise<Payment> {
  return api.get<Payment>(
    `/payments/booking/${bookingId}`,
  )
}

/* ─── Mutations ─── */

export async function refundPayment(
  id: string,
  payload: RefundPayload,
): Promise<Payment> {
  return api.post<Payment>(
    `/payments/${id}/refund`,
    payload,
  )
}

export async function updatePaymentStatus(
  id: string,
  payload: UpdatePaymentStatusPayload,
): Promise<Payment> {
  return api.patch<Payment>(
    `/payments/${id}/status`,
    payload,
  )
}

export async function verifyBankTransfer(
  id: string,
  payload: VerifyBankTransferPayload,
): Promise<void> {
  await api.post(`/payments/bank-transfer/${id}/verify`, payload)
}

// Note: receipt review is handled via verifyBankTransfer (POST /payments/bank-transfer/:id/verify)
// This function kept for backward compatibility — routes to the correct endpoint
export async function reviewReceipt(
  receiptId: string,
  payload: ReviewReceiptPayload,
): Promise<void> {
  await api.post(`/payments/bank-transfer/${receiptId}/verify`, {
    action: payload.approved ? "approve" : "reject",
    adminNotes: payload.adminNotes,
  })
}
