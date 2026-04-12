import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  fetchProblemReports,
  createProblemReport,
  updateProblemReportStatus,
  type ListProblemReportsQuery,
  type CreateProblemReportPayload,
  type ProblemReport,
  type ProblemReportStatus,
} from "@/lib/api/problem-reports"

export const problemReportKeys = {
  all: ["problem-reports"] as const,
  list: (query: ListProblemReportsQuery) =>
    ["problem-reports", "list", query] as const,
}

export function useProblemReports(query: ListProblemReportsQuery = {}) {
  return useQuery({
    queryKey: problemReportKeys.list(query),
    queryFn: () => fetchProblemReports(query),
    staleTime: 30 * 1000,
  })
}

export function useCreateProblemReport() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateProblemReportPayload) =>
      createProblemReport(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: problemReportKeys.all })
    },
  })
}

export function useUpdateProblemReportStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      status,
    }: {
      id: string
      status: ProblemReportStatus
    }) => updateProblemReportStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: problemReportKeys.all })
    },
  })
}
