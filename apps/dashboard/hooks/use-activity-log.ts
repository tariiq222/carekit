"use client"

import { useQuery } from "@tanstack/react-query"
import { useState, useCallback } from "react"
import { fetchActivityLogs } from "@/lib/api/activity-log"
import type { ActivityLogQuery } from "@/lib/types/activity-log"

const QUERY_KEY = ["activity-log"] as const

export function useActivityLogs() {
  const [page, setPage] = useState(1)
  const [module, setModule] = useState<string | undefined>()
  const [action, setAction] = useState<string | undefined>()
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")

  const query: ActivityLogQuery = {
    page,
    perPage: 20,
    sortOrder: "desc",
    module,
    action,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  }

  const { data, isLoading, error } = useQuery({
    queryKey: [...QUERY_KEY, "list", query],
    queryFn: () => fetchActivityLogs(query),
  })

  const hasFilters = !!module || !!action || !!dateFrom || !!dateTo

  const resetFilters = useCallback(() => {
    setModule(undefined)
    setAction(undefined)
    setDateFrom("")
    setDateTo("")
    setPage(1)
  }, [])

  return {
    logs: data?.items ?? [],
    meta: data?.meta ?? null,
    isLoading,
    error: error?.message ?? null,
    page,
    setPage,
    module,
    setModule: (m: string | undefined) => { setModule(m); setPage(1) },
    action,
    setAction: (a: string | undefined) => { setAction(a); setPage(1) },
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    hasFilters,
    resetFilters,
  }
}
