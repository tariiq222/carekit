import { useQuery } from '@tanstack/react-query';

import { notificationsService } from '@/services/notifications';
import type { PaginatedResponse } from '@/types/api';
import type { Notification } from '@/types/models';

export const notificationKeys = {
  all: ['notifications'] as const,
  list: (params?: { page?: number; perPage?: number }) =>
    [...notificationKeys.all, 'list', params ?? {}] as const,
  unreadCount: () => [...notificationKeys.all, 'unread-count'] as const,
};

export function useNotifications(params?: { page?: number; perPage?: number }) {
  return useQuery<PaginatedResponse<Notification>>({
    queryKey: notificationKeys.list(params),
    queryFn: () => notificationsService.getAll(params),
  });
}
