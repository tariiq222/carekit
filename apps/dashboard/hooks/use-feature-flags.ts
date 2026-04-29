"use client"

import { useQuery } from "@tanstack/react-query"
import {
  fetchFeatureFlags,
  fetchFeatureFlagMap,
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
  })

  const map: FeatureFlagMap = data ?? {}

  function isEnabled(key: string): boolean {
    return map[key] === true
  }

  return { map, isEnabled }
}
