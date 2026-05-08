import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { deletePlan } from './delete-plan.api';
import { plansListKey } from '../list-plans/use-list-plans';
import { withSentryMutation } from '@/lib/sentry-mutation';

export function useDeletePlan() {
  const qc = useQueryClient();
  return useMutation(withSentryMutation({
    context: 'admin:plan:delete',
    mutationFn: deletePlan,
    onSuccess: () => {
      toast.success('Plan deleted.');
      void qc.invalidateQueries({ queryKey: plansListKey });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to delete plan');
    },
  }));
}
