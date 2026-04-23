import { adminRequest } from '@/lib/api-client';

export interface DeletePlanCommand {
  planId: string;
  reason: string;
}

export function deletePlan({ planId, reason }: DeletePlanCommand): Promise<void> {
  return adminRequest<void>(`/plans/${planId}`, {
    method: 'DELETE',
    body: JSON.stringify({ reason }),
  });
}
