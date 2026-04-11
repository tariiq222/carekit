/**
 * Invoices API — CareKit Dashboard
 */

import { api, getAccessToken } from "@/lib/api"
import type { PaginatedResponse } from "@/lib/types/common"
import type {
  Invoice,
  InvoiceStats,
  InvoiceListQuery,
  CreateInvoicePayload,
} from "@/lib/types/invoice"

/* ─── Queries ─── */

export async function fetchInvoices(
  query: InvoiceListQuery = {},
): Promise<PaginatedResponse<Invoice>> {
  return api.get<PaginatedResponse<Invoice>>("/invoices", {
    page: query.page,
    perPage: query.perPage,
    search: query.search,
    dateFrom: query.dateFrom,
    dateTo: query.dateTo,
    zatcaStatus: query.zatcaStatus,
  })
}

export async function fetchInvoice(id: string): Promise<Invoice> {
  return api.get<Invoice>(`/invoices/${id}`)
}

export async function fetchInvoiceStats(): Promise<InvoiceStats> {
  return api.get<InvoiceStats>("/invoices/stats")
}

export async function fetchInvoiceByPayment(
  paymentId: string,
): Promise<Invoice> {
  return api.get<Invoice>(
    `/invoices/payment/${paymentId}`,
  )
}

export async function fetchInvoiceHtml(id: string): Promise<string> {
  const token = getAccessToken()

  const res = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5100/api/v1"}/invoices/${id}/html`,
    {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      credentials: "include",
    },
  )

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body?.message ?? body?.error?.message ?? res.statusText)
  }
  return res.text()
}

/* ─── Mutations ─── */

export async function createInvoice(
  payload: CreateInvoicePayload,
): Promise<Invoice> {
  return api.post<Invoice>("/invoices", payload)
}

export async function markInvoiceAsSent(id: string): Promise<Invoice> {
  return api.patch<Invoice>(`/invoices/${id}/send`)
}
