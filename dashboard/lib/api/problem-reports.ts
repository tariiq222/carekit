/**
 * Problem Reports API -- CareKit Dashboard
 */

import { api } from "@/lib/api"
import type { PaginatedResponse } from "@/lib/types/common"
import type {
  ProblemReport,
  ProblemReportListQuery,
  ResolveProblemReportPayload,
} from "@/lib/types/problem-report"

/* ─── Queries ─── */

export async function fetchProblemReports(
  query: ProblemReportListQuery = {},
): Promise<PaginatedResponse<ProblemReport>> {
  return api.get<PaginatedResponse<ProblemReport>>("/problem-reports", {
    page: query.page,
    perPage: query.perPage,
    status: query.status,
    patientId: query.patientId,
  })
}

export async function fetchProblemReport(
  id: string,
): Promise<ProblemReport> {
  return api.get<ProblemReport>(
    `/problem-reports/${id}`,
  )
}

/* ─── Mutations ─── */

export async function resolveProblemReport(
  id: string,
  payload: ResolveProblemReportPayload,
): Promise<ProblemReport> {
  return api.patch<ProblemReport>(
    `/problem-reports/${id}/resolve`,
    payload,
  )
}
