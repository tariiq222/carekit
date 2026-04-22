import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { endImpersonation } from './end-impersonation.api';

export function useEndImpersonation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: endImpersonation,
    onSuccess: () => {
      toast.success('Impersonation session ended.');
      void qc.invalidateQueries({ queryKey: ['impersonation-sessions'] });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to end session');
    },
  });
}
