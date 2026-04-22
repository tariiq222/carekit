import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { startImpersonation } from './start-impersonation.api';

export function useStartImpersonation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: startImpersonation,
    onSuccess: () => {
      toast.success('Impersonation session started.');
      void qc.invalidateQueries({ queryKey: ['impersonation-sessions'] });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to start impersonation');
    },
  });
}
