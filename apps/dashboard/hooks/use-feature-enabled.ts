"use client"

import type { FeatureKey } from "@deqah/shared/constants"
import { useBilling } from "@/lib/billing/billing-context"
import { isFeatureEnabledForBilling } from "@/lib/billing/utils"

/**
 * Returns true when the current tenant's plan limits enable `key`.
 *
 * The generic constraint forces callers to pass a `FeatureKey` enum value
 * (or a literal string narrowed to one). Raw `string` callers fail to
 * compile — the dual-registry typo era is over.
 */
export function useFeatureEnabled<K extends FeatureKey>(key: K): boolean {
  const { limits, status } = useBilling()

  return isFeatureEnabledForBilling({
    limits,
    feature: key,
    status,
  })
}
