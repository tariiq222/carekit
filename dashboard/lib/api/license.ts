/**
 * License API — CareKit Dashboard
 */

import { api } from "@/lib/api"
import type {
  LicenseConfig,
  UpdateLicensePayload,
  FeatureWithStatus,
} from "@/lib/types/license"

/* ─── Queries ─── */

export async function fetchLicense(): Promise<LicenseConfig> {
  return api.get<LicenseConfig>("/license")
}

export async function fetchLicenseFeatures(): Promise<FeatureWithStatus[]> {
  return api.get<FeatureWithStatus[]>("/license/features")
}

/* ─── Mutations ─── */

export async function updateLicense(
  data: UpdateLicensePayload,
): Promise<LicenseConfig> {
  return api.put<LicenseConfig>("/license", data)
}
