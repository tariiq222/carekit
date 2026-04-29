import { adminRequest } from '@/lib/api-client';

export interface EntitlementRow {
  id: string;
  key: string;
  nameAr: string;
  nameEn: string;
  descriptionAr: string | null;
  descriptionEn: string | null;
  allowedPlans: string[];
  limitKind: string | null;
  planDerivedEnabled: boolean;
  overrideEnabled: boolean | null;
  enabled: boolean;
  source: 'PLAN' | 'ORG_OVERRIDE';
  overrideUpdatedAt: string | null;
}

export interface UpdateEntitlementCommand {
  organizationId: string;
  key: string;
  enabled: boolean;
  reason: string;
}

export function listEntitlements(organizationId: string): Promise<EntitlementRow[]> {
  const params = new URLSearchParams({ organizationId });
  return adminRequest<EntitlementRow[]>(`/feature-flags?${params.toString()}`);
}

export function updateEntitlement(cmd: UpdateEntitlementCommand): Promise<EntitlementRow> {
  return adminRequest<EntitlementRow>(`/feature-flags/${cmd.key}`, {
    method: 'PATCH',
    body: JSON.stringify({
      organizationId: cmd.organizationId,
      enabled: cmd.enabled,
      reason: cmd.reason,
    }),
  });
}
