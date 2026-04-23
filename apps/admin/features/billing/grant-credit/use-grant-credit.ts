import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { grantCredit } from './grant-credit.api';

export function useGrantCredit(orgId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: grantCredit,
    onSuccess: () => {
      toast.success('Credit granted.');
      void qc.invalidateQueries({ queryKey: ['billing', 'org', orgId] });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to grant credit');
    },
  });
}
