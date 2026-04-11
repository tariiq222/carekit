import api from './api';
import type { ApiResponse, PaginatedResponse } from '@/types/api';
import type { Notification } from '@/types/models';

interface NotificationParams {
  page?: number;
  perPage?: number;
}

export const notificationsService = {
  async getAll(params?: NotificationParams) {
    const response = await api.get<PaginatedResponse<Notification>>(
      '/notifications',
      { params },
    );
    return response.data;
  },

  async getUnreadCount() {
    const response = await api.get<ApiResponse<{ count: number }>>(
      '/notifications/unread-count',
    );
    return response.data;
  },

  async markAllRead() {
    const response = await api.patch<ApiResponse<{ updated: boolean }>>(
      '/notifications/read-all',
    );
    return response.data;
  },

  async markRead(id: string) {
    const response = await api.patch<ApiResponse<Notification>>(
      `/notifications/${id}/read`,
    );
    return response.data;
  },

  async registerFcmToken(token: string, platform: 'ios' | 'android') {
    const response = await api.post<ApiResponse<unknown>>(
      '/notifications/fcm-token',
      { token, platform },
    );
    return response.data;
  },

  async unregisterFcmToken() {
    const response = await api.delete<ApiResponse<{ deleted: boolean }>>(
      '/notifications/fcm-token',
    );
    return response.data;
  },
};
