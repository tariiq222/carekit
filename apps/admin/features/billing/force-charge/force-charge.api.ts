import { adminRequest } from '@/lib/api-client';

export interface ForceChargeResult {
  success: boolean;
  message: string;
  result: { ok: boolean; status: string; attemptNumber: number };
}

export function forceCharge(orgId: string): Promise<ForceChargeResult> {
  return adminRequest<ForceChargeResult>(`/billing/subscriptions/${orgId}/force-charge`, {
    method: 'POST',
  });
}
