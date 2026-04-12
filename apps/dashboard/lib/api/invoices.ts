/**
 * Invoices API — CareKit Dashboard
 * Controller: dashboard/finance/invoices
 */

import { api } from "@/lib/api"
import type { Invoice, CreateInvoicePayload } from "@/lib/types/invoice"

export async function fetchInvoice(id: string): Promise<Invoice> {
  return api.get<Invoice>(`/dashboard/finance/invoices/${id}`)
}

export async function createInvoice(
  payload: CreateInvoicePayload,
): Promise<Invoice> {
  return api.post<Invoice>("/dashboard/finance/invoices", payload)
}
