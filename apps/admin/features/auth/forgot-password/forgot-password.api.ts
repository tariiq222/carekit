import '@/lib/api-client';
import { authApi } from '@deqah/api-client';

export function requestPasswordReset(email: string): Promise<void> {
  return authApi.requestStaffPasswordReset(email);
}
