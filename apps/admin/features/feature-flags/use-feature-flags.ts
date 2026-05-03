'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  listFeatureFlags,
  updateFeatureFlag,
  upsertFeatureFlagOverride,
} from './feature-flags.api';

export function useFeatureFlags() {
  return useQuery({ queryKey: ['feature-flags'], queryFn: listFeatureFlags });
}

export function useUpdateFeatureFlag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      key,
      body,
    }: {
      key: string;
      body: { organizationId: string; enabled: boolean; reason: string };
    }) => updateFeatureFlag(key, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['feature-flags'] }),
  });
}

export function useUpsertOverride() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: upsertFeatureFlagOverride,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['feature-flags'] }),
  });
}
