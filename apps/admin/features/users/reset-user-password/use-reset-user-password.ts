import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { resetUserPassword } from './reset-user-password.api';
import { withSentryMutation } from '@/lib/sentry-mutation';

export function useResetUserPassword() {
  return useMutation(withSentryMutation({
    context: 'admin:user:reset-password',
    mutationFn: resetUserPassword,
    onSuccess: () => {
      toast.success('Temp password issued. The user will receive it by email (if SMTP is configured).');
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to reset password');
    },
  }));
}
