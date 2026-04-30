import { useMutation, useQueryClient } from '@tanstack/react-query';
import { cancelScheduledCancellation } from './cancel-scheduled.api';
import { orgBillingKey } from '../get-org-billing/use-get-org-billing';

export function useCancelScheduled(orgId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => cancelScheduledCancellation(orgId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: orgBillingKey(orgId) });
    },
  });
}
