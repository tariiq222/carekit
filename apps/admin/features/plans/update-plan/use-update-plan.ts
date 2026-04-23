import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { updatePlan } from './update-plan.api';
import { plansListKey } from '../list-plans/use-list-plans';

export function useUpdatePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: updatePlan,
    onSuccess: () => {
      toast.success('Plan updated.');
      void qc.invalidateQueries({ queryKey: plansListKey });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to update plan');
    },
  });
}
