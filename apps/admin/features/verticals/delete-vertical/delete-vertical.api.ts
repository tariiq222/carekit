import { adminRequest } from '@/lib/api-client';

export interface DeleteVerticalCommand {
  verticalId: string;
  reason: string;
}

export function deleteVertical({ verticalId, reason }: DeleteVerticalCommand): Promise<void> {
  return adminRequest<void>(`/verticals/${verticalId}`, {
    method: 'DELETE',
    body: JSON.stringify({ reason }),
  });
}
