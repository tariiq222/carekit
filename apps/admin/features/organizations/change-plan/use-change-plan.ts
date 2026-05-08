import { useMutation, useQueryClient } from '@tanstack/react-query';
import { changePlanForOrg, type ChangePlanCommand } from './change-plan.api';
import { orgBillingKey } from '../get-org-billing/use-get-org-billing';
import { withSentryMutation } from '@/lib/sentry-mutation';

export function useChangePlan(orgId: string) {
  const qc = useQueryClient();
  return useMutation(withSentryMutation({
    context: 'admin:organization:change-plan',
    mutationFn: (cmd: ChangePlanCommand) => changePlanForOrg(orgId, cmd),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: orgBillingKey(orgId) });
    },
  }));
}
