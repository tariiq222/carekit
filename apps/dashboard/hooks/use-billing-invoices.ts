"use client"

/**
 * Phase 7 — Billing invoices listing + PDF download hooks for the tenant
 * dashboard. Distinct from `use-invoices` which serves booking invoices.
 */

import { useMutation, useQuery } from "@tanstack/react-query"
import { billingApi } from "@/lib/api/billing"
import type {
  DownloadInvoiceResponse,
  InvoiceListFilters,
  InvoiceListResponse,
} from "@/lib/types/billing"

export function useBillingInvoices(filters: InvoiceListFilters) {
  return useQuery<InvoiceListResponse>({
    queryKey: ["billing", "invoices", filters],
    queryFn: () => billingApi.listInvoices(filters),
  })
}

export function useDownloadBillingInvoice() {
  return useMutation<DownloadInvoiceResponse, Error, string>({
    mutationFn: (id: string) => billingApi.downloadInvoice(id),
    onSuccess: ({ url }) => {
      if (typeof window !== "undefined") {
        window.open(url, "_blank", "noopener")
      }
    },
  })
}
