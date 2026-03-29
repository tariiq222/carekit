/**
 * Notifications API — CareKit Dashboard
 */

import { api } from "@/lib/api"
import type { PaginatedResponse } from "@/lib/types/common"
import type {
  Notification,
  NotificationListQuery,
  UnreadCount,
} from "@/lib/types/notification"

/* ─── Queries ─── */

export async function fetchNotifications(
  query: NotificationListQuery = {},
): Promise<PaginatedResponse<Notification>> {
  return api.get<PaginatedResponse<Notification>>("/notifications", {
    page: query.page,
    perPage: query.perPage,
  })
}

export async function fetchUnreadCount(): Promise<number> {
  const res = await api.get<UnreadCount>(
    "/notifications/unread-count",
  )
  return res.count
}

/* ─── Mutations ─── */

export async function markAllAsRead(): Promise<void> {
  await api.patch("/notifications/read-all")
}

export async function markAsRead(id: string): Promise<void> {
  await api.patch(`/notifications/${id}/read`)
}
