"use client"

import { useQuery, keepPreviousData } from "@tanstack/react-query"
import { useState, useCallback } from "react"
import { queryKeys } from "@/lib/query-keys"
import {
  fetchPractitioners,
  fetchPractitioner,
  fetchAvailability,
  fetchBreaks,
  fetchVacations,
  fetchPractitionerServices,
  fetchPractitionerServiceTypes,
} from "@/lib/api/practitioners"
import type { PractitionerListQuery } from "@/lib/types/practitioner"

// Re-export mutations from dedicated file for backward compatibility
export {
  usePractitionerMutations,
  useSetAvailability,
  useSetBreaks,
  useVacationMutations,
  usePractitionerServiceMutations,
} from "./use-practitioner-mutations"

/* ─── List Hook ─── */

export function usePractitioners() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const [isActive, setIsActive] = useState<boolean | undefined>()

  const query: PractitionerListQuery = {
    page,
    perPage: 20,
    search: search || undefined,
    isActive,
  }

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.practitioners.list(query),
    queryFn: () => fetchPractitioners(query),
    placeholderData: keepPreviousData,
    staleTime: 5 * 60 * 1000, // 5 min
  })

  const resetFilters = useCallback(() => {
    setSearch("")
    setIsActive(undefined)
    setPage(1)
  }, [])

  const hasFilters = !!(search || isActive !== undefined)

  const items = data?.items ?? []

  return {
    practitioners: items,
    meta: data?.meta ?? null,
    isLoading,
    error: error?.message ?? null,
    page,
    setPage,
    search,
    setSearch: (s: string) => { setSearch(s); setPage(1) },
    isActive,
    setIsActive: (v: boolean | undefined) => { setIsActive(v); setPage(1) },
    hasFilters,
    resetFilters,
    refetch,
  }
}

/* ─── Detail Hook ─── */

export function usePractitioner(id: string | null) {
  return useQuery({
    queryKey: queryKeys.practitioners.detail(id!),
    queryFn: () => fetchPractitioner(id!),
    enabled: !!id,
    staleTime: 10 * 60 * 1000, // 10 min
  })
}

/* ─── Availability Query ─── */

export function usePractitionerAvailability(id: string | null) {
  return useQuery({
    queryKey: queryKeys.practitioners.availability(id!),
    queryFn: () => fetchAvailability(id!),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  })
}

/* ─── Breaks Query ─── */

export function usePractitionerBreaks(id: string | null) {
  return useQuery({
    queryKey: queryKeys.practitioners.breaks(id!),
    queryFn: () => fetchBreaks(id!),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  })
}

/* ─── Vacations Query ─── */

export function usePractitionerVacations(id: string | null) {
  return useQuery({
    queryKey: queryKeys.practitioners.vacations(id!),
    queryFn: () => fetchVacations(id!),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  })
}

/* ─── Practitioner Services Query ─── */

export function usePractitionerServices(id: string | null) {
  return useQuery({
    queryKey: queryKeys.practitioners.services(id!),
    queryFn: () => fetchPractitionerServices(id!),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  })
}

/* ─── Practitioner Service Types Query ─── */

export function usePractitionerServiceTypes(
  practitionerId: string | null,
  serviceId: string | null,
) {
  const enabled = !!practitionerId && !!serviceId
  return useQuery({
    queryKey: queryKeys.practitioners.serviceTypes(practitionerId ?? "", serviceId ?? ""),
    queryFn: () => fetchPractitionerServiceTypes(practitionerId!, serviceId!),
    enabled,
  })
}
