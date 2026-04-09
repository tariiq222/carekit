"use client"

import { useState, useCallback } from "react"
import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { fetchOfferings, fetchSessions, fetchSession } from "@/lib/api/group-sessions"
import type { OfferingListQuery, SessionListQuery, GroupSessionStatus } from "@/lib/types/group-sessions"

export function useGroupOfferings() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const [practitionerId, setPractitionerId] = useState<string | undefined>()

  const query: OfferingListQuery = {
    page,
    perPage: 20,
    search: search || undefined,
    practitionerId,
  }

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.groupSessions.offerings.list(query),
    queryFn: () => fetchOfferings(query),
    staleTime: 5 * 60 * 1000,
  })

  const resetFilters = useCallback(() => {
    setSearch("")
    setPractitionerId(undefined)
    setPage(1)
  }, [])

  return {
    offerings: data?.items ?? [],
    meta: data?.meta ?? null,
    isLoading,
    error: error instanceof Error ? error.message : null,
    page,
    setPage,
    search,
    setSearch: (s: string) => { setSearch(s); setPage(1) },
    practitionerId,
    setPractitionerId: (v: string | undefined) => { setPractitionerId(v); setPage(1) },
    resetFilters,
    refetch,
  }
}

export function useGroupSessions() {
  const [page, setPage] = useState(1)
  const [groupOfferingId, setGroupOfferingId] = useState<string | undefined>()
  const [status, setStatus] = useState<GroupSessionStatus | undefined>()

  const query: SessionListQuery = {
    page,
    perPage: 20,
    groupOfferingId,
    status,
  }

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.groupSessions.sessions.list(query),
    queryFn: () => fetchSessions(query),
    staleTime: 5 * 60 * 1000,
  })

  const resetFilters = useCallback(() => {
    setGroupOfferingId(undefined)
    setStatus(undefined)
    setPage(1)
  }, [])

  return {
    sessions: data?.items ?? [],
    meta: data?.meta ?? null,
    isLoading,
    error: error instanceof Error ? error.message : null,
    page,
    setPage,
    groupOfferingId,
    setGroupOfferingId: (v: string | undefined) => { setGroupOfferingId(v); setPage(1) },
    status,
    setStatus: (v: GroupSessionStatus | undefined) => { setStatus(v); setPage(1) },
    resetFilters,
    refetch,
  }
}

export function useGroupSessionDetail(id: string) {
  return useQuery({
    queryKey: queryKeys.groupSessions.sessions.detail(id),
    queryFn: () => fetchSession(id),
    staleTime: 2 * 60 * 1000,
    enabled: !!id,
  })
}
