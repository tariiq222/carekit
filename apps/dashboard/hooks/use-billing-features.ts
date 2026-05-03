"use client"

/**
 * useBillingFeatures — Deqah Dashboard
 *
 * Fetches the authenticated organization's billing features from
 * `GET /dashboard/billing/my-features`.
 *
 * The response includes per-feature `enabled` flags and optional quantitative
 * limits (`limit` + `currentCount`) for plan-enforced constraints such as
 * branch count, employee seats, and monthly booking volume.
 *
 * staleTime matches the Redis subscription cache TTL (5 min) so the browser
 * does not refetch on every navigation while still reflecting plan changes
 * within the same window.
 *
 * @see T-05 `GetMyFeaturesHandler` (backend)
 * @see `useQuantitativeLimitReached` (this directory)
 */

import { useQuery } from "@tanstack/react-query"

import { api } from "@/lib/api"
import { queryKeys } from "@/lib/query-keys"
import type { BillingFeaturesResponse } from "@deqah/shared"

/* ─── Constants ─── */

const FEATURES_ENDPOINT = "/dashboard/billing/my-features"

/** 5 minutes — mirrors the Redis subscription cache TTL set in T-05. */
const STALE_TIME = 5 * 60 * 1000

/* ─── Hook ─── */

/**
 * Returns the full billing features payload for the current organization.
 *
 * @example
 * ```ts
 * const { data, isLoading } = useBillingFeatures()
 * const branchLimit = data?.features?.branches?.limit ?? -1
 * ```
 */
export function useBillingFeatures() {
  return useQuery<BillingFeaturesResponse>({
    queryKey: queryKeys.billing.features(),
    queryFn: () => api.get<BillingFeaturesResponse>(FEATURES_ENDPOINT),
    staleTime: STALE_TIME,
    retry: false,
  })
}

/**
 * Compatibility shim — provides the same `isEnabled(key)` interface that
 * components previously got from `useFeatureFlagMap()` in `use-feature-flags.ts`.
 *
 * Reads from `useBillingFeatures()` (Plan.limits via GET /dashboard/billing/my-features)
 * instead of the removed FeatureFlag table endpoints.
 *
 * The `key` argument must match the JSON key in `Plan.limits` exactly
 * (e.g. `"walk_in_bookings"`, not `"walk_in"`).
 */
export function useFeatureFlagMap() {
  const { data } = useBillingFeatures()
  const features = data?.features ?? {}

  function isEnabled(key: string): boolean {
    const entry = features[key]
    if (!entry) return false
    return entry.enabled === true
  }

  return { isEnabled }
}
