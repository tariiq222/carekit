import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { updatePlan } from './update-plan.api';
import { plansListKey } from '../list-plans/use-list-plans';
import { withSentryMutation } from '@/lib/sentry-mutation';

export function useUpdatePlan() {
  const qc = useQueryClient();
  return useMutation(withSentryMutation({
    context: 'admin:plan:update',
    mutationFn: updatePlan,
    onSuccess: () => {
      toast.success('Plan updated.');
      void qc.invalidateQueries({ queryKey: plansListKey });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to update plan');
    },
  }));
}
