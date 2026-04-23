import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { createPlan } from './create-plan.api';
import { plansListKey } from '../list-plans/use-list-plans';

export function useCreatePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createPlan,
    onSuccess: () => {
      toast.success('Plan created.');
      void qc.invalidateQueries({ queryKey: plansListKey });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to create plan');
    },
  });
}
