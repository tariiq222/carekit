"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useState, useCallback } from "react"
import { queryKeys } from "@/lib/query-keys"
import {
  fetchPayments,
  fetchPaymentStats,
  refundPayment,
  updatePaymentStatus,
  verifyBankTransfer,
  reviewReceipt,
} from "@/lib/api/payments"
import type { PaymentListQuery } from "@/lib/types/payment"
import type { PaymentStatus, PaymentMethod } from "@/lib/types/common"

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

/* ─── Stats ─── */

export function usePaymentStats() {
  return useQuery({
    queryKey: queryKeys.payments.stats(),
    queryFn: fetchPaymentStats,
  })
}

/* ─── Mutations ─── */

export function usePaymentMutations() {
  const queryClient = useQueryClient()
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.payments.all })

  const refundMut = useMutation({
    mutationFn: ({ id, ...payload }: { id: string } & Parameters<typeof refundPayment>[1]) =>
      refundPayment(id, payload),
    onSuccess: invalidate,
  })

  const statusMut = useMutation({
    mutationFn: ({ id, ...payload }: { id: string } & Parameters<typeof updatePaymentStatus>[1]) =>
      updatePaymentStatus(id, payload),
    onSuccess: invalidate,
  })

  const verifyMut = useMutation({
    mutationFn: ({ id, ...payload }: { id: string } & Parameters<typeof verifyBankTransfer>[1]) =>
      verifyBankTransfer(id, payload),
    onSuccess: invalidate,
  })

  const reviewMut = useMutation({
    mutationFn: ({ receiptId, ...payload }: { receiptId: string } & Parameters<typeof reviewReceipt>[1]) =>
      reviewReceipt(receiptId, payload),
    onSuccess: invalidate,
  })

  return { refundMut, statusMut, verifyMut, reviewMut }
}
