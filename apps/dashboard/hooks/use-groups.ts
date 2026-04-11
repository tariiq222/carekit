"use client"

import { useState, useCallback } from "react"
import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { fetchGroups, fetchGroup } from "@/lib/api/groups"
import type { GroupListQuery, GroupStatus, DeliveryMode } from "@/lib/types/groups"

export function useGroups() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const [employeeId, setEmployeeId] = useState<string | undefined>()
  const [status, setStatus] = useState<GroupStatus | undefined>()
  const [deliveryMode, setDeliveryMode] = useState<DeliveryMode | undefined>()
  const [visibility, setVisibility] = useState<"published" | "draft" | undefined>()

  const query: GroupListQuery = {
    page,
    perPage: 20,
    search: search || undefined,
    employeeId,
    status,
    deliveryMode,
    visibility,
  }

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.groups.list(query),
    queryFn: () => fetchGroups(query),
    staleTime: 5 * 60 * 1000,
  })

  const resetFilters = useCallback(() => {
    setSearch("")
    setEmployeeId(undefined)
    setStatus(undefined)
    setDeliveryMode(undefined)
    setVisibility(undefined)
    setPage(1)
  }, [])

  return {
    groups: data?.items ?? [],
    meta: data?.meta ?? null,
    isLoading,
    error: error instanceof Error ? error.message : null,
    page,
    setPage,
    search,
    setSearch: (s: string) => { setSearch(s); setPage(1) },
    employeeId,
    setEmployeeId: (v: string | undefined) => { setEmployeeId(v); setPage(1) },
    status,
    setStatus: (v: GroupStatus | undefined) => { setStatus(v); setPage(1) },
    deliveryMode,
    setDeliveryMode: (v: DeliveryMode | undefined) => { setDeliveryMode(v); setPage(1) },
    visibility,
    setVisibility: (v: "published" | "draft" | undefined) => { setVisibility(v); setPage(1) },
    resetFilters,
    refetch,
  }
}

export function useGroupDetail(id: string) {
  return useQuery({
    queryKey: queryKeys.groups.detail(id),
    queryFn: () => fetchGroup(id),
    staleTime: 2 * 60 * 1000,
    enabled: !!id,
  })
}
