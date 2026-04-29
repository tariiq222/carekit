import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  listEntitlements,
  updateEntitlement,
  type UpdateEntitlementCommand,
} from './list-entitlements.api';

export const entitlementsKey = (organizationId: string) =>
  ['organizations', 'entitlements', organizationId] as const;

export function useEntitlements(organizationId: string) {
  return useQuery({
    queryKey: entitlementsKey(organizationId),
    queryFn: () => listEntitlements(organizationId),
  });
}

export function useUpdateEntitlement(organizationId: string) {
  const qc = useQueryClient();
  const t = useTranslations('organizations.entitlements');

  return useMutation({
    mutationFn: (cmd: Omit<UpdateEntitlementCommand, 'organizationId'>) =>
      updateEntitlement({ organizationId, ...cmd }),
    onSuccess: () => {
      toast.success(t('success'));
      void qc.invalidateQueries({ queryKey: entitlementsKey(organizationId) });
      void qc.invalidateQueries({ queryKey: ['audit-log', 'list'] });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : t('errorFallback'));
    },
  });
}
