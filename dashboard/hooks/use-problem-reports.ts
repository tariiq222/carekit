"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useState, useCallback } from "react"
import { queryKeys } from "@/lib/query-keys"
import {
  fetchProblemReports,
  resolveProblemReport,
} from "@/lib/api/problem-reports"
import type { ProblemReportListQuery, ProblemReportStatus } from "@/lib/types/problem-report"

/* ─── List Hook ─── */

export function useProblemReports() {
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState<ProblemReportStatus | undefined>()

  const query: ProblemReportListQuery = {
    page,
    perPage: 20,
    status,
  }

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.problemReports.list(query),
    queryFn: () => fetchProblemReports(query),
  })

  const resetFilters = useCallback(() => {
    setStatus(undefined)
    setPage(1)
  }, [])

  return {
    reports: data?.items ?? [],
    meta: data?.meta ?? null,
    isLoading,
    error: error?.message ?? null,
    page,
    setPage,
    status,
    setStatus: (s: ProblemReportStatus | undefined) => {
      setStatus(s)
      setPage(1)
    },
    resetFilters,
    refetch,
  }
}

/* ─── Resolve Mutation ─── */

export function useResolveProblemReport() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      id,
      ...payload
    }: { id: string } & Parameters<typeof resolveProblemReport>[1]) =>
      resolveProblemReport(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.problemReports.all,
      })
    },
  })
}
