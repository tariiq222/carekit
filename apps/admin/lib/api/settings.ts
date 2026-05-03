import { adminRequest } from '../api-client';

export async function getPlatformSetting(key: string) {
  return adminRequest<{ key: string; value: string } | null>(`/settings/${key}`);
}

export async function upsertPlatformSetting(body: { key: string; value?: string; secret?: string }) {
  return adminRequest<void>('/settings', { method: 'PUT', body: JSON.stringify(body) });
}
