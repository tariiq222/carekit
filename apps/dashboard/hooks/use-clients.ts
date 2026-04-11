"use client"

import { useQuery, useQueryClient, useMutation, keepPreviousData } from "@tanstack/react-query"
import { useState, useCallback } from "react"
import { queryKeys } from "@/lib/query-keys"
import { fetchClients, fetchClient, fetchClientStats, fetchClientBookings, fetchClientListStats, updateClient, createWalkInClient, activateClient, deactivateClient } from "@/lib/api/clients"
import type { ClientListQuery } from "@/lib/types/client"

/* ─── List Hook ─── */

export function useClients() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const [isActive, setIsActive] = useState<boolean | undefined>()

  const query: ClientListQuery = {
    page,
    perPage: 20,
    search: search || undefined,
    isActive,
  }

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.clients.list(query),
    queryFn: () => fetchClients(query),
    placeholderData: keepPreviousData,
    staleTime: 5 * 60 * 1000, // 5 min
  })

  const resetSearch = useCallback(() => {
    setSearch("")
    setIsActive(undefined)
    setPage(1)
  }, [])

  const items = data?.items ?? []

  return {
    clients: items,
    meta: data?.meta ?? null,
    isLoading,
    error: error?.message ?? null,
    page,
    setPage,
    search,
    setSearch: (s: string) => { setSearch(s); setPage(1) },
    isActive,
    setIsActive: (v: boolean | undefined) => { setIsActive(v); setPage(1) },
    resetSearch,
    refetch,
  }
}

/* ─── Detail Hook ─── */

export function useClient(id: string | null) {
  return useQuery({
    queryKey: queryKeys.clients.detail(id!),
    queryFn: () => fetchClient(id!),
    enabled: !!id,
    staleTime: 10 * 60 * 1000, // 10 min
  })
}

/* ─── Stats Hook ─── */

export function useClientStats(id: string | null) {
  return useQuery({
    queryKey: queryKeys.clients.stats(id!),
    queryFn: () => fetchClientStats(id!),
    enabled: !!id,
  })
}

/* ─── Mutations ─── */

export function useClientMutations() {
  const queryClient = useQueryClient()
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.clients.all })

  const createMut = useMutation({
    mutationFn: createWalkInClient,
    onSuccess: () => invalidate(),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Parameters<typeof updateClient>[1] }) =>
      updateClient(id, payload),
    onSuccess: () => invalidate(),
  })

  const activateMut = useMutation({ mutationFn: activateClient, onSuccess: invalidate })
  const deactivateMut = useMutation({ mutationFn: deactivateClient, onSuccess: invalidate })

  return { createMut, updateMut, activateMut, deactivateMut }
}

/* ─── Bookings Hook ─── */

export function useClientBookings(id: string | null) {
  return useQuery({
    queryKey: queryKeys.clients.bookings(id!),
    queryFn: () => fetchClientBookings(id!),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  })
}

/* ─── List Stats Hook ─── */

export function useClientListStats() {
  return useQuery({
    queryKey: queryKeys.clients.listStats(),
    queryFn: fetchClientListStats,
    staleTime: 2 * 60 * 1000, // 2 min — changes more frequently than detail data
  })
}

/* ─── Invalidation ─── */

export function useInvalidateClients() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: queryKeys.clients.all })
}
