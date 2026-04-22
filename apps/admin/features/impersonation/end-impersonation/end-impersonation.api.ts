import { adminRequest } from '@/lib/api-client';

export function endImpersonation(sessionId: string): Promise<void> {
  return adminRequest<void>(`/impersonation/${sessionId}/end`, { method: 'POST' });
}
