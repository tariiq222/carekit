import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { createTenant, type CreateTenantCommand } from './create-tenant.api';

export function useCreateTenant() {
  const qc = useQueryClient();
  const t = useTranslations('organizations.create');

  return useMutation({
    mutationFn: (cmd: CreateTenantCommand) => createTenant(cmd),
    onSuccess: () => {
      toast.success(t('success'));
      void qc.invalidateQueries({ queryKey: ['organizations', 'list'] });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : t('errorFallback'));
    },
  });
}
