import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { createPlan } from './create-plan.api';
import { plansListKey } from '../list-plans/use-list-plans';
import { withSentryMutation } from '@/lib/sentry-mutation';

export function useCreatePlan() {
  const qc = useQueryClient();
  return useMutation(withSentryMutation({
    context: 'admin:plan:create',
    mutationFn: createPlan,
    onSuccess: () => {
      toast.success('Plan created.');
      void qc.invalidateQueries({ queryKey: plansListKey });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to create plan');
    },
  }));
}
