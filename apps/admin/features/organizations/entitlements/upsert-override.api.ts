import { adminRequest } from '@/lib/api-client';
import type { FeatureKey } from '@deqah/shared';

export type OverrideMode = 'INHERIT' | 'FORCE_ON' | 'FORCE_OFF';

export interface UpsertOverrideInput {
  organizationId: string;
  key: FeatureKey;
  mode: OverrideMode;
  reason: string;
}

export function upsertOverride(input: UpsertOverrideInput): Promise<{ success: true }> {
  return adminRequest<{ success: true }>(`/feature-flags/override`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}
