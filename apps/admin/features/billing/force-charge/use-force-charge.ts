import { useMutation, useQueryClient } from '@tanstack/react-query';
import { forceCharge } from './force-charge.api';
import { orgBillingKey } from '../get-org-billing/use-get-org-billing';

export function useForceCharge(orgId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => forceCharge(orgId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: orgBillingKey(orgId) });
    },
  });
}
