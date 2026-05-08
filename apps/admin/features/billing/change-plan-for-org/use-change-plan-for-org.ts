import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { changePlanForOrg, listPlanOptions } from './change-plan-for-org.api';
import { withSentryMutation } from '@/lib/sentry-mutation';

export function usePlanOptions() {
  return useQuery({
    queryKey: ['billing', 'plan-options'],
    queryFn: listPlanOptions,
  });
}

export function useChangePlanForOrg(orgId: string) {
  const qc = useQueryClient();
  return useMutation(withSentryMutation({
    context: 'admin:billing:change-plan',
    mutationFn: changePlanForOrg,
    onSuccess: () => {
      toast.success('Plan changed.');
      void qc.invalidateQueries({ queryKey: ['billing', 'org', orgId] });
      void qc.invalidateQueries({ queryKey: ['billing', 'subscriptions'] });
      void qc.invalidateQueries({ queryKey: ['billing', 'metrics'] });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to change plan');
    },
  }));
}
