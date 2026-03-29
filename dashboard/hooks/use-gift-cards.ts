"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useState, useCallback } from "react"
import { queryKeys } from "@/lib/query-keys"
import {
  fetchGiftCards,
  fetchGiftCard,
  createGiftCard,
  updateGiftCard,
  deactivateGiftCard,
  addGiftCardCredit,
} from "@/lib/api/gift-cards"
import type { GiftCardListQuery, AddCreditPayload } from "@/lib/types/gift-card"

/* ─── Gift Cards List ─── */

export function useGiftCards() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState<string | undefined>()

  const query: GiftCardListQuery = {
    page,
    perPage: 20,
    search: search || undefined,
    status: status as GiftCardListQuery["status"],
  }

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.giftCards.list(query),
    queryFn: () => fetchGiftCards(query),
  })

  const resetFilters = useCallback(() => {
    setSearch("")
    setStatus(undefined)
    setPage(1)
  }, [])

  return {
    giftCards: data?.items ?? [],
    meta: data?.meta ?? null,
    isLoading,
    error: error?.message ?? null,
    page,
    setPage,
    search,
    setSearch: (s: string) => { setSearch(s); setPage(1) },
    status,
    setStatus: (s: string | undefined) => { setStatus(s); setPage(1) },
    resetFilters,
    refetch,
  }
}

/* ─── Gift Card Detail ─── */

export function useGiftCard(id: string | null) {
  return useQuery({
    queryKey: queryKeys.giftCards.detail(id ?? ""),
    queryFn: () => fetchGiftCard(id!),
    enabled: !!id,
  })
}

/* ─── Gift Card Mutations ─── */

export function useGiftCardMutations() {
  const queryClient = useQueryClient()
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.giftCards.all })

  const createMut = useMutation({
    mutationFn: createGiftCard,
    onSuccess: invalidate,
  })

  const updateMut = useMutation({
    mutationFn: ({ id, ...payload }: { id: string } & Parameters<typeof updateGiftCard>[1]) =>
      updateGiftCard(id, payload),
    onSuccess: invalidate,
  })

  const deactivateMut = useMutation({
    mutationFn: deactivateGiftCard,
    onSuccess: invalidate,
  })

  const addCreditMut = useMutation({
    mutationFn: ({ id, ...payload }: { id: string } & AddCreditPayload) =>
      addGiftCardCredit(id, payload),
    onSuccess: invalidate,
  })

  return { createMut, updateMut, deactivateMut, addCreditMut }
}
