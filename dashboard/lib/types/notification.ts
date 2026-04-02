/**
 * Notification Types — CareKit Dashboard
 */

import type { PaginatedQuery, NotificationType } from "./common"

/* ─── Entities ─── */

export interface Notification {
  id: string
  userId: string
  type: NotificationType
  titleEn: string
  titleAr: string
  bodyEn: string
  bodyAr: string
  isRead: boolean
  data: Record<string, unknown> | null
  createdAt: string
}

/* ─── Query ─── */

export type NotificationListQuery = PaginatedQuery

/* ─── Response ─── */

export interface UnreadCount {
  count: number
}
