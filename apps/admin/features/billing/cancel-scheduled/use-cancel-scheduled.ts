import { useMutation, useQueryClient } from '@tanstack/react-query';
import { cancelScheduledCancellation } from './cancel-scheduled.api';
import { orgBillingKey } from '../get-org-billing/use-get-org-billing';
import { withSentryMutation } from '@/lib/sentry-mutation';

export function useCancelScheduled(orgId: string) {
  const qc = useQueryClient();
  return useMutation(withSentryMutation({
    context: 'admin:billing:cancel-scheduled',
    mutationFn: () => cancelScheduledCancellation(orgId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: orgBillingKey(orgId) });
    },
  }));
}
