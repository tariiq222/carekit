"use client"

import { useBilling } from "@/lib/billing/billing-context"
import { isFeatureEnabledForBilling } from "@/lib/billing/utils"

export function useFeatureEnabled(feature: string) {
  const { limits, status } = useBilling()

  return isFeatureEnabledForBilling({
    limits,
    feature,
    status,
  })
}
