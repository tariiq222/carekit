"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useState, useCallback } from "react"
import { queryKeys } from "@/lib/query-keys"
import { fetchWaitlist, removeWaitlistEntry } from "@/lib/api/waitlist"
import type { WaitlistStatus } from "@/lib/types/waitlist"

/* ─── Waitlist List ─── */

export function useWaitlist() {
  const [practitionerId, setPractitionerId] = useState<string | undefined>()
  const [status, setStatus] = useState<WaitlistStatus | undefined>()

  const query = {
    practitionerId,
    status,
  }

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.waitlist.list(query),
    queryFn: () => fetchWaitlist(query),
    staleTime: 30_000,
  })

  const resetFilters = useCallback(() => {
    setPractitionerId(undefined)
    setStatus(undefined)
  }, [])

  return {
    entries: data ?? [],
    isLoading,
    error: error?.message ?? null,
    practitionerId,
    setPractitionerId,
    status,
    setStatus,
    resetFilters,
    refetch,
  }
}

/* ─── Waitlist Mutations ─── */

export function useWaitlistMutations() {
  const queryClient = useQueryClient()
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.waitlist.all })

  const removeMut = useMutation({
    mutationFn: removeWaitlistEntry,
    onSuccess: invalidate,
  })

  return { removeMut }
}
