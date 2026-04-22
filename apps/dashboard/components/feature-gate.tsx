"use client"

import type { ReactNode } from "react"
import { useFeatureEnabled } from "@/hooks/use-feature-enabled"

interface FeatureGateProps {
  feature: string
  children: ReactNode
  fallback?: ReactNode
}

export function FeatureGate({
  feature,
  children,
  fallback = null,
}: FeatureGateProps) {
  const enabled = useFeatureEnabled(feature)
  return enabled ? <>{children}</> : <>{fallback}</>
}
