import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { startImpersonation } from './start-impersonation.api';
import { withSentryMutation } from '@/lib/sentry-mutation';

export function useStartImpersonation() {
  const qc = useQueryClient();
  return useMutation(withSentryMutation({
    context: 'admin:impersonation:start',
    mutationFn: startImpersonation,
    onSuccess: () => {
      toast.success('Impersonation session started.');
      void qc.invalidateQueries({ queryKey: ['impersonation-sessions'] });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to start impersonation');
    },
  }));
}
