/**
 * Activity Log API — Deqah Dashboard
 */

import { api } from "@/lib/api"
import type { PaginatedResponse } from "@/lib/types/common"
import type { ActivityLog, ActivityLogQuery } from "@/lib/types/activity-log"

/* ─── Queries ─── */

export async function fetchActivityLogs(
  query: ActivityLogQuery = {},
): Promise<PaginatedResponse<ActivityLog>> {
  return api.get<PaginatedResponse<ActivityLog>>("/dashboard/ops/activity", {
    page: query.page,
    limit: query.perPage,
    sortBy: query.sortBy,
    sortOrder: query.sortOrder,
    module: query.module,
    action: query.action,
    userId: query.userId,
    fromDate: query.dateFrom,
    toDate: query.dateTo,
  })
}
