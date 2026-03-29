"use client"

import { useQuery, useQueryClient, useMutation, keepPreviousData } from "@tanstack/react-query"
import { useState, useCallback } from "react"
import { queryKeys } from "@/lib/query-keys"
import { fetchPatients, fetchPatient, fetchPatientStats, fetchPatientBookings, fetchPatientListStats, updatePatient, createWalkInPatient, activatePatient, deactivatePatient } from "@/lib/api/patients"
import type { PatientListQuery } from "@/lib/types/patient"

/* ─── List Hook ─── */

export function usePatients() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const [isActive, setIsActive] = useState<boolean | undefined>()

  const query: PatientListQuery = {
    page,
    perPage: 20,
    search: search || undefined,
    isActive,
  }

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.patients.list(query),
    queryFn: () => fetchPatients(query),
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
    patients: items,
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

export function usePatient(id: string | null) {
  return useQuery({
    queryKey: queryKeys.patients.detail(id!),
    queryFn: () => fetchPatient(id!),
    enabled: !!id,
    staleTime: 10 * 60 * 1000, // 10 min
  })
}

/* ─── Stats Hook ─── */

export function usePatientStats(id: string | null) {
  return useQuery({
    queryKey: queryKeys.patients.stats(id!),
    queryFn: () => fetchPatientStats(id!),
    enabled: !!id,
  })
}

/* ─── Mutations ─── */

export function usePatientMutations() {
  const queryClient = useQueryClient()
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.patients.all })

  const createMut = useMutation({
    mutationFn: createWalkInPatient,
    onSuccess: () => invalidate(),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Parameters<typeof updatePatient>[1] }) =>
      updatePatient(id, payload),
    onSuccess: () => invalidate(),
  })

  const activateMut = useMutation({ mutationFn: activatePatient, onSuccess: invalidate })
  const deactivateMut = useMutation({ mutationFn: deactivatePatient, onSuccess: invalidate })

  return { createMut, updateMut, activateMut, deactivateMut }
}

/* ─── Bookings Hook ─── */

export function usePatientBookings(id: string | null) {
  return useQuery({
    queryKey: queryKeys.patients.bookings(id!),
    queryFn: () => fetchPatientBookings(id!),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  })
}

/* ─── List Stats Hook ─── */

export function usePatientListStats() {
  return useQuery({
    queryKey: queryKeys.patients.listStats(),
    queryFn: fetchPatientListStats,
    staleTime: 2 * 60 * 1000, // 2 min — changes more frequently than detail data
  })
}

/* ─── Invalidation ─── */

export function useInvalidatePatients() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: queryKeys.patients.all })
}
