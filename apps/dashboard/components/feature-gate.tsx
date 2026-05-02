"use client"

import type { ReactNode } from "react"
import type { FeatureKey } from "@deqah/shared/constants"
import { useFeatureEnabled } from "@/hooks/use-feature-enabled"

interface FeatureGateProps {
  feature: FeatureKey
  children: ReactNode
  fallback?: ReactNode
}

/**
 * Renders `children` when the current tenant's plan enables `feature`.
 * Renders `fallback` (default `null`) otherwise.
 *
 * `feature` is typed to the FeatureKey enum — passing an arbitrary string
 * fails to compile.
 */
export function FeatureGate({
  feature,
  children,
  fallback = null,
}: FeatureGateProps) {
  const enabled = useFeatureEnabled(feature)
  return enabled ? <>{children}</> : <>{fallback}</>
}
