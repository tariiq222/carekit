"use client"

import { useBilling } from "@/lib/billing/billing-context"

export function useCurrentPlan() {
  const { plan, limits, status, isLoading } = useBilling()
  return { plan, limits, status, isLoading }
}
