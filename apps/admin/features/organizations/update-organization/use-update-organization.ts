import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { organizationDetailKey } from '../get-organization/use-get-organization';
import { updateOrganization, type UpdateOrganizationCommand } from './update-organization.api';

export function useUpdateOrganization(organizationId: string) {
  const qc = useQueryClient();
  const t = useTranslations('organizations.update');

  return useMutation({
    mutationFn: (cmd: Omit<UpdateOrganizationCommand, 'organizationId'>) =>
      updateOrganization({ organizationId, ...cmd }),
    onSuccess: () => {
      toast.success(t('success'));
      void qc.invalidateQueries({ queryKey: organizationDetailKey(organizationId) });
      void qc.invalidateQueries({ queryKey: ['organizations', 'list'] });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : t('errorFallback'));
    },
  });
}
