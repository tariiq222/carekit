/**
 * Feature Flags API — CareKit Dashboard
 */

import { api } from "@/lib/api"
import type { FeatureFlag, FeatureFlagMap } from "@/lib/types/feature-flag"

/** Get all feature flags (admin) */
export async function fetchFeatureFlags(): Promise<FeatureFlag[]> {
  return api.get<FeatureFlag[]>("/feature-flags")
}

/** Get feature flags as { key: boolean } map (public) */
export async function fetchFeatureFlagMap(): Promise<FeatureFlagMap> {
  return api.get<FeatureFlagMap>("/feature-flags/map")
}

/** Toggle a feature flag */
export async function updateFeatureFlag(
  key: string,
  enabled: boolean,
): Promise<FeatureFlag> {
  return api.patch<FeatureFlag>(
    `/feature-flags/${key}`,
    { enabled },
  )
}
