import { useMutation, useQueryClient } from '@tanstack/react-query';
import { forceCharge } from './force-charge.api';
import { orgBillingKey } from '../get-org-billing/use-get-org-billing';
import { withSentryMutation } from '@/lib/sentry-mutation';

export function useForceCharge(orgId: string) {
  const qc = useQueryClient();
  return useMutation(withSentryMutation({
    context: 'admin:billing:force-charge',
    mutationFn: () => forceCharge(orgId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: orgBillingKey(orgId) });
    },
  }));
}
