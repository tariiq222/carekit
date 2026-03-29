/**
 * Activity Log API — CareKit Dashboard
 */

import { api } from "@/lib/api"
import type { PaginatedResponse } from "@/lib/types/common"
import type { ActivityLog, ActivityLogQuery } from "@/lib/types/activity-log"

/* ─── Queries ─── */

export async function fetchActivityLogs(
  query: ActivityLogQuery = {},
): Promise<PaginatedResponse<ActivityLog>> {
  return api.get<PaginatedResponse<ActivityLog>>("/activity-log", {
    page: query.page,
    perPage: query.perPage,
    sortBy: query.sortBy,
    sortOrder: query.sortOrder,
    module: query.module,
    action: query.action,
    userId: query.userId,
    dateFrom: query.dateFrom,
    dateTo: query.dateTo,
  })
}

export async function fetchActivityLog(id: string): Promise<ActivityLog> {
  return api.get<ActivityLog>(
    `/activity-log/${id}`,
  )
}
