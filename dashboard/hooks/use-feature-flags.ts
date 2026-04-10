"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  fetchFeatureFlags,
  fetchFeatureFlagMap,
  updateFeatureFlag,
} from "@/lib/api/feature-flags"
import type { FeatureFlag, FeatureFlagMap } from "@/lib/types/feature-flag"
import { queryKeys } from "@/lib/query-keys"

/* ─── Query Key ─── */

const FEATURE_FLAGS_KEY = ["feature-flags"] as const

/* ─── Full Feature Flags List (admin) ─── */

export function useFeatureFlags() {
  const { data, isLoading } = useQuery({
    queryKey: FEATURE_FLAGS_KEY,
    queryFn: fetchFeatureFlags,
    staleTime: 5 * 60 * 1000,
  })

  return {
    flags: (data ?? []) as FeatureFlag[],
    isLoading,
  }
}

/* ─── Feature Flag Map (key → enabled) ─── */

export function useFeatureFlagMap() {
  const { data } = useQuery({
    queryKey: queryKeys.featureFlags.map(),
    queryFn: fetchFeatureFlagMap,
    staleTime: 5 * 60 * 1000,
    refetchOnMount: true,
  })

  const map: FeatureFlagMap = data ?? {}

  function isEnabled(key: string): boolean {
    return map[key] === true
  }

  return { map, isEnabled }
}

/* ─── Toggle Mutation ─── */

export function useFeatureFlagMutation() {
  const queryClient = useQueryClient()

  const toggleMut = useMutation({
    mutationFn: ({ key, enabled }: { key: string; enabled: boolean }) =>
      updateFeatureFlag(key, enabled),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FEATURE_FLAGS_KEY })
      queryClient.invalidateQueries({ queryKey: queryKeys.featureFlags.map() })
    },
    onError: (error: unknown) => {
      const status = (error as { response?: { status?: number } })?.response?.status
      if (status === 403) {
        toast.error("هذه الميزة غير متاحة في باقتك الحالية")
      }
    },
  })

  return { toggleMut }
}
