"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useState, useCallback } from "react"
import { queryKeys } from "@/lib/query-keys"
import {
  fetchPayments,
  fetchPaymentStats,
} from "@/lib/api/payments"
import type { PaymentListQuery, PaymentStats } from "@/lib/types/payment"
import type { PaymentStatus, PaymentMethod } from "@/lib/types/common"

export type { PaymentStats }

export function usePaymentStats() {
  return useQuery({
    queryKey: queryKeys.payments.stats(),
    queryFn: fetchPaymentStats,
    staleTime: 5 * 60 * 1000,
  })
}

/* ─── Mutations stub — TODO: no backend endpoints for refund/verify ─── */

export function usePaymentMutations() {
  const refundMut = {
    mutateAsync: async (_args: unknown) => { throw new Error("Not implemented") },
    isPending: false,
  }
  const verifyMut = {
    mutateAsync: async (_args: unknown) => { throw new Error("Not implemented") },
    isPending: false,
  }
  return { refundMut, verifyMut }
}

/* ─── List Hook ─── */

export function usePayments() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState<PaymentStatus | "all">("all")
  const [method, setMethod] = useState<PaymentMethod | "all">("all")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")

  const query: PaymentListQuery = {
    page,
    perPage: 20,
    search: search || undefined,
    status: status !== "all" ? status : undefined,
    method: method !== "all" ? method : undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  }

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.payments.list(query),
    queryFn: () => fetchPayments(query),
  })

  const hasFilters = !!search || status !== "all" || method !== "all" || !!dateFrom || !!dateTo

  const resetFilters = useCallback(() => {
    setStatus("all")
    setMethod("all")
    setDateFrom("")
    setDateTo("")
    setPage(1)
  }, [])

  return {
    payments: data?.items ?? [],
    meta: data?.meta ?? null,
    isLoading,
    error: error?.message ?? null,
    page,
    setPage,
    search,
    setSearch: (s: string) => { setSearch(s); setPage(1) },
    status,
    setStatus: (s: PaymentStatus | "all") => { setStatus(s); setPage(1) },
    method,
    setMethod: (m: PaymentMethod | "all") => { setMethod(m); setPage(1) },
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    hasFilters,
    resetFilters,
    refetch,
  }
}
