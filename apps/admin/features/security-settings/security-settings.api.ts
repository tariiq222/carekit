import { adminRequest } from '@/lib/api-client';

export interface SecuritySettings {
  sessionTtlMinutes: number;
  require2fa: boolean;
  ipAllowlist: string[];
}

export async function getSecuritySettings(): Promise<SecuritySettings> {
  return adminRequest<SecuritySettings>('/settings/security');
}

export async function updateSecuritySettings(body: SecuritySettings): Promise<void> {
  return adminRequest<void>('/settings/security', {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}
