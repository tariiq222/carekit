import { adminRequest } from '@/lib/api-client';

export interface BillingSettingEntry {
  key: string;
  value: unknown;
  isSecret: boolean;
}

export interface GetAllBillingSettingsResult {
  settings: BillingSettingEntry[];
}

export interface UpdateBillingSettingResult {
  updated: boolean;
}

export interface TestConnectionResult {
  ok: boolean;
  error?: string;
  latencyMs: number;
  statusCode?: number;
}

export function getAllBillingSettings(): Promise<GetAllBillingSettingsResult> {
  return adminRequest<GetAllBillingSettingsResult>('/settings/billing');
}

export function updateBillingSetting(key: string, value: unknown): Promise<UpdateBillingSettingResult> {
  return adminRequest<UpdateBillingSettingResult>(`/settings/billing/${encodeURIComponent(key)}`, {
    method: 'PATCH',
    body: JSON.stringify({ value }),
    headers: { 'Content-Type': 'application/json' },
  });
}

export function testMoyasarConnection(): Promise<TestConnectionResult> {
  return adminRequest<TestConnectionResult>('/settings/billing/test-connection', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
}
