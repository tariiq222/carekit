import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { reinstateOrganization } from './reinstate-organization.api';
import { organizationDetailKey } from '../get-organization/use-get-organization';

export function useReinstateOrganization(organizationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (reason: string) =>
      reinstateOrganization({
        organizationId,
        reason: reason.trim() || 'Reinstated by super-admin',
      }),
    onSuccess: () => {
      toast.success('Organization reinstated.');
      void qc.invalidateQueries({ queryKey: organizationDetailKey(organizationId) });
      void qc.invalidateQueries({ queryKey: ['organizations', 'list'] });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Reinstate failed');
    },
  });
}
