"use client"

import { useState, useCallback } from "react"
import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { fetchGroupSessions, fetchGroupSession } from "@/lib/api/group-sessions"
import type { GroupSessionListQuery, GroupSessionStatus } from "@/lib/types/group-sessions"

export function useGroupSessions() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const [practitionerId, setPractitionerId] = useState<string | undefined>()
  const [status, setStatus] = useState<GroupSessionStatus | undefined>()
  const [visibility, setVisibility] = useState<"published" | "draft" | undefined>()

  const query: GroupSessionListQuery = {
    page,
    perPage: 20,
    search: search || undefined,
    practitionerId,
    status,
    visibility,
  }

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.groupSessions.list(query),
    queryFn: () => fetchGroupSessions(query),
    staleTime: 5 * 60 * 1000,
  })

  const resetFilters = useCallback(() => {
    setSearch("")
    setPractitionerId(undefined)
    setStatus(undefined)
    setVisibility(undefined)
    setPage(1)
  }, [])

  return {
    sessions: data?.items ?? [],
    meta: data?.meta ?? null,
    isLoading,
    error: error instanceof Error ? error.message : null,
    page,
    setPage,
    search,
    setSearch: (s: string) => { setSearch(s); setPage(1) },
    practitionerId,
    setPractitionerId: (v: string | undefined) => { setPractitionerId(v); setPage(1) },
    status,
    setStatus: (v: GroupSessionStatus | undefined) => { setStatus(v); setPage(1) },
    visibility,
    setVisibility: (v: "published" | "draft" | undefined) => { setVisibility(v); setPage(1) },
    resetFilters,
    refetch,
  }
}

export function useGroupSessionDetail(id: string) {
  return useQuery({
    queryKey: queryKeys.groupSessions.detail(id),
    queryFn: () => fetchGroupSession(id),
    staleTime: 2 * 60 * 1000,
    enabled: !!id,
  })
}
