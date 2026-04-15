"use client"

import { useQuery, keepPreviousData } from "@tanstack/react-query"
import { useState, useCallback, useEffect } from "react"
import { queryKeys } from "@/lib/query-keys"
import {
  fetchEmployees,
  fetchEmployee,
  fetchAvailability,
  fetchBreaks,
  fetchVacations,
  fetchEmployeeServices,
  fetchEmployeeServiceTypes,
  fetchEmployeeStats,
} from "@/lib/api/employees"
import type { EmployeeListQuery } from "@/lib/types/employee"

// Re-export mutations from dedicated file for backward compatibility
export {
  useEmployeeMutations,
  useSetAvailability,
  useSetBreaks,
  useVacationMutations,
  useEmployeeServiceMutations,
} from "./use-employee-mutations"

/* ─── List Hook ─── */

export function useEmployees() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [isActive, setIsActive] = useState<boolean | undefined>()

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(t)
  }, [search])

  const query: EmployeeListQuery = {
    page,
    perPage: 20,
    search: debouncedSearch || undefined,
    isActive,
  }

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.employees.list(query),
    queryFn: () => fetchEmployees(query),
    placeholderData: keepPreviousData,
    staleTime: 5 * 60 * 1000, // 5 min
  })

  const resetFilters = useCallback(() => {
    setSearch("")
    setDebouncedSearch("")
    setIsActive(undefined)
    setPage(1)
  }, [])

  const hasFilters = !!(debouncedSearch || isActive !== undefined)

  const items = data?.items ?? []

  return {
    employees: items,
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

/* ─── Stats Hook ─── */

export function useEmployeeStats() {
  return useQuery({
    queryKey: queryKeys.employees.stats(),
    queryFn: fetchEmployeeStats,
    staleTime: 60 * 1000,
  })
}

/* ─── Detail Hook ─── */

export function useEmployee(id: string | null) {
  return useQuery({
    queryKey: queryKeys.employees.detail(id!),
    queryFn: () => fetchEmployee(id!),
    enabled: !!id,
    staleTime: 10 * 60 * 1000, // 10 min
  })
}

/* ─── Availability Query ─── */

export function useEmployeeAvailability(id: string | null) {
  return useQuery({
    queryKey: queryKeys.employees.availability(id!),
    queryFn: () => fetchAvailability(id!),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  })
}

/* ─── Breaks Query ─── */

export function useEmployeeBreaks(id: string | null) {
  return useQuery({
    queryKey: queryKeys.employees.breaks(id!),
    queryFn: () => fetchBreaks(id!),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  })
}

/* ─── Vacations Query ─── */

export function useEmployeeVacations(id: string | null) {
  return useQuery({
    queryKey: queryKeys.employees.vacations(id!),
    queryFn: () => fetchVacations(id!),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  })
}

/* ─── Employee Services Query ─── */

export function useEmployeeServices(id: string | null) {
  return useQuery({
    queryKey: queryKeys.employees.services(id!),
    queryFn: () => fetchEmployeeServices(id!),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  })
}

/* ─── Employee Service Types Query ─── */

export function useEmployeeServiceTypes(
  employeeId: string | null,
  serviceId: string | null,
) {
  const enabled = !!employeeId && !!serviceId
  return useQuery({
    queryKey: queryKeys.employees.serviceTypes(employeeId ?? "", serviceId ?? ""),
    queryFn: () => fetchEmployeeServiceTypes(employeeId!, serviceId!),
    enabled,
  })
}
