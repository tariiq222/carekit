"use client"

import type { FeatureKey } from "@deqah/shared/constants"

import { useBillingFeatures } from "./use-billing-features"

/**
 * Returns `true` when a quantitative feature has reached its plan limit.
 *
 * Logic:
 * - Feature not enabled           → `false`  (feature is off entirely)
 * - No `limit` or `limit === -1`  → `false`  (unlimited)
 * - `currentCount >= limit`       → `true`   (quota exhausted)
 *
 * @example
 * ```ts
 * const atBranchLimit = useQuantitativeLimitReached(FeatureKey.BRANCHES)
 * if (atBranchLimit) {
 *   // show upgrade prompt instead of "Add Branch" button
 * }
 * ```
 */
export function useQuantitativeLimitReached(feature: FeatureKey): boolean {
  const { data } = useBillingFeatures()
  const entry = data?.features?.[feature]

  if (!entry?.enabled || entry.limit === undefined || entry.limit === -1) {
    return false
  }

  return (entry.currentCount ?? 0) >= entry.limit
}
