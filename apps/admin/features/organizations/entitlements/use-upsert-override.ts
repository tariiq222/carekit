'use client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { upsertOverride, type UpsertOverrideInput } from './upsert-override.api';

export function useUpsertOverride() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpsertOverrideInput) => upsertOverride(input),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['admin', 'org', vars.organizationId, 'entitlements'] });
      qc.invalidateQueries({ queryKey: ['admin', 'org', vars.organizationId, 'feature-flags'] });
    },
  });
}
