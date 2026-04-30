import '@/lib/api-client';
import { authApi } from '@deqah/api-client';

export function resetPassword(token: string, newPassword: string): Promise<void> {
  return authApi.performStaffPasswordReset(token, newPassword);
}
