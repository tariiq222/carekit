import { adminRequest } from '@/lib/api-client';

export interface SuspendOrganizationCommand {
  organizationId: string;
  reason: string;
}

export function suspendOrganization(cmd: SuspendOrganizationCommand): Promise<void> {
  return adminRequest<void>(`/organizations/${cmd.organizationId}/suspend`, {
    method: 'POST',
    body: JSON.stringify({ reason: cmd.reason }),
  });
}
