import { adminRequest } from '@/lib/api-client';

export interface PlatformFeatureFlag {
  key: string;
  enabledByDefault: boolean;
  overrides: Array<{ organizationId: string; enabled: boolean }>;
}

export async function listFeatureFlags(): Promise<PlatformFeatureFlag[]> {
  return adminRequest<PlatformFeatureFlag[]>('/admin/feature-flags');
}

export async function updateFeatureFlag(
  key: string,
  body: { organizationId: string; enabled: boolean; reason: string },
): Promise<void> {
  return adminRequest<void>(`/admin/feature-flags/${key}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export async function upsertFeatureFlagOverride(body: {
  key: string;
  organizationId: string;
  enabled: boolean;
  reason: string;
}): Promise<void> {
  return adminRequest<void>('/admin/feature-flags/override', {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}
