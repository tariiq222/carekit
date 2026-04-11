import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { notificationsApi } from '@carekit/api-client'
import type { NotificationListQuery } from '@carekit/api-client'
import { QUERY_KEYS } from '@/lib/query-keys'

export function useNotifications(query: NotificationListQuery = {}) {
  return useQuery({
    queryKey: QUERY_KEYS.notifications.list(query as Record<string, unknown>),
    queryFn: () => notificationsApi.list(query),
  })
}

export function useUnreadCount() {
  return useQuery({
    queryKey: QUERY_KEYS.notifications.unreadCount,
    queryFn: () => notificationsApi.unreadCount(),
  })
}

export function useMarkNotificationRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.notifications.all })
    },
  })
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.notifications.all })
    },
  })
}
