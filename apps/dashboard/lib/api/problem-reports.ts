/**
 * Problem Reports API — CareKit Dashboard
 * Controller: dashboard/platform/problem-reports
 */

import { api } from "@/lib/api"
import type { PaginatedResponse } from "@/lib/types/common"

export type ProblemReportStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED"
export type ProblemReportType = "BUG" | "FEATURE_REQUEST" | "IMPROVEMENT" | "OTHER"

export interface ProblemReport {
  id: string
  tenantId: string
  reporterId: string
  type: ProblemReportType
  title: string
  description: string
  status: ProblemReportStatus
  resolution?: string
  createdAt: string
  updatedAt: string
}

export interface CreateProblemReportPayload {
  reporterId: string
  type: ProblemReportType
  title: string
  description: string
}

export interface ListProblemReportsQuery {
  page?: number
  limit?: number
  status?: ProblemReportStatus
}

export async function fetchProblemReports(
  query: ListProblemReportsQuery = {},
): Promise<PaginatedResponse<ProblemReport>> {
  return api.get<PaginatedResponse<ProblemReport>>(
    "/dashboard/platform/problem-reports",
    {
      page: query.page,
      limit: query.limit,
      status: query.status,
    },
  )
}

export async function createProblemReport(
  payload: CreateProblemReportPayload,
): Promise<ProblemReport> {
  return api.post<ProblemReport>(
    "/dashboard/platform/problem-reports",
    payload,
  )
}

export async function updateProblemReportStatus(
  id: string,
  status: ProblemReportStatus,
): Promise<ProblemReport> {
  return api.patch<ProblemReport>(
    `/dashboard/platform/problem-reports/${id}/status`,
    { status },
  )
}
