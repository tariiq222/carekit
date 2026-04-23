import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { deletePlan } from './delete-plan.api';
import { plansListKey } from '../list-plans/use-list-plans';

export function useDeletePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deletePlan,
    onSuccess: () => {
      toast.success('Plan deleted.');
      void qc.invalidateQueries({ queryKey: plansListKey });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to delete plan');
    },
  });
}
