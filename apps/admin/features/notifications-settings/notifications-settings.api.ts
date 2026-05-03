import { adminRequest } from '@/lib/api-client';

export type NotificationChannel = 'EMAIL' | 'SMS' | 'PUSH' | 'INAPP';

export interface QuietHours {
  startHour: number;
  endHour: number;
  timezone: string;
}

export interface FcmCredentials {
  serverKey: string;
  projectId: string;
  clientEmail: string;
}

export interface NotificationDefaults {
  defaultChannels: NotificationChannel[];
  quietHours: QuietHours;
  fcm: FcmCredentials;
}

export async function getNotificationsConfig(): Promise<NotificationDefaults> {
  return adminRequest<NotificationDefaults>('/admin/notifications-config');
}

export async function updateNotificationsConfig(body: {
  defaultChannels: NotificationChannel[];
  quietHours: QuietHours;
  fcm: Partial<FcmCredentials>;
}): Promise<void> {
  return adminRequest<void>('/admin/notifications-config', {
    method: 'PUT',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}
