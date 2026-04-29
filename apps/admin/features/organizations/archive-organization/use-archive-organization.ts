import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { organizationDetailKey } from '../get-organization/use-get-organization';
import { archiveOrganization } from './archive-organization.api';

export function useArchiveOrganization(organizationId: string) {
  const qc = useQueryClient();
  const t = useTranslations('organizations.archive');

  return useMutation({
    mutationFn: (reason: string) => archiveOrganization({ organizationId, reason }),
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
