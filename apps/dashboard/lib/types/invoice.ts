/**
 * Invoice Types — Deqah Dashboard
 */

import type { PaginatedQuery, ZatcaStatus } from "./common"

/* ─── Entities ─── */

export interface Invoice {
  id: string
  invoiceNumber: string
  paymentId: string
  subtotal: number
  taxAmount: number
  totalAmount: number
  zatcaStatus: ZatcaStatus
  zatcaHash: string | null
  qrCode: string | null
  sentAt: string | null
  createdAt: string
  updatedAt: string
  payment?: {
    id: string
    method: string
    status: string
    booking?: {
      id: string
      date: string
      client: { firstName: string; lastName: string } | null
      employee: {
        user: { firstName: string; lastName: string }
      }
      service: { nameAr: string; nameEn: string }
    }
  }
}

export interface InvoiceStats {
  total: number
  totalAmount: number
  submitted: number
  accepted: number
  rejected: number
  pending: number
}

/* ─── Query ─── */

export interface InvoiceListQuery extends PaginatedQuery {
  search?: string
  dateFrom?: string
  dateTo?: string
  zatcaStatus?: ZatcaStatus
}

/* ─── DTOs ─── */

export interface CreateInvoicePayload {
  paymentId: string
}
