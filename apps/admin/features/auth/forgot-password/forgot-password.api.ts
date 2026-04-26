import '@/lib/api-client';
import { authApi } from '@carekit/api-client';

export function requestPasswordReset(email: string): Promise<void> {
  return authApi.requestStaffPasswordReset(email);
}
