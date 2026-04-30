/**
 * Feature Flags API — Deqah Dashboard
 */

import { api } from "@/lib/api"
import type { FeatureFlag, FeatureFlagMap } from "@/lib/types/feature-flag"

/** Get all feature flags (admin) */
export async function fetchFeatureFlags(): Promise<FeatureFlag[]> {
  return api.get<FeatureFlag[]>("/dashboard/platform/feature-flags")
}

/** Get feature flags as { key: boolean } map (public) */
export async function fetchFeatureFlagMap(): Promise<FeatureFlagMap> {
  return api.get<FeatureFlagMap>("/dashboard/platform/feature-flags/map")
}
