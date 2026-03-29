"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useState, useCallback } from "react"
import { queryKeys } from "@/lib/query-keys"
import {
  fetchInvoices,
  fetchInvoiceStats,
  createInvoice,
  markInvoiceAsSent,
} from "@/lib/api/invoices"
import type { InvoiceListQuery } from "@/lib/types/invoice"
import type { ZatcaStatus } from "@/lib/types/common"

/* ─── List Hook ─── */

export function useInvoices() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [zatcaStatus, setZatcaStatus] = useState<ZatcaStatus | "all">("all")

  const query: InvoiceListQuery = {
    page,
    perPage: 20,
    search: search || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    zatcaStatus: zatcaStatus !== "all" ? zatcaStatus : undefined,
  }

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.invoices.list(query),
    queryFn: () => fetchInvoices(query),
  })

  const hasFilters = !!search || !!dateFrom || !!dateTo || zatcaStatus !== "all"

  const resetFilters = useCallback(() => {
    setSearch("")
    setDateFrom("")
    setDateTo("")
    setZatcaStatus("all")
    setPage(1)
  }, [])

  return {
    invoices: data?.items ?? [],
    meta: data?.meta ?? null,
    isLoading,
    error: error?.message ?? null,
    page,
    setPage,
    search,
    setSearch: (s: string) => { setSearch(s); setPage(1) },
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    zatcaStatus,
    setZatcaStatus: (s: ZatcaStatus | "all") => { setZatcaStatus(s); setPage(1) },
    hasFilters,
    resetFilters,
    refetch,
  }
}

/* ─── Stats ─── */

export function useInvoiceStats() {
  return useQuery({
    queryKey: queryKeys.invoices.stats(),
    queryFn: fetchInvoiceStats,
  })
}

/* ─── Mutations ─── */

export function useInvoiceMutations() {
  const queryClient = useQueryClient()
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all })

  const createMut = useMutation({
    mutationFn: createInvoice,
    onSuccess: invalidate,
  })

  const sendMut = useMutation({
    mutationFn: markInvoiceAsSent,
    onSuccess: invalidate,
  })

  return { createMut, sendMut }
}
