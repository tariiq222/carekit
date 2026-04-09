/**
 * Clinic Settings API — CareKit Dashboard
 */

import { api } from "@/lib/api"
import type {
  ClinicSettings,
  UpdateClinicSettingsPayload,
  PublicClinicSettings,
} from "@/lib/types/clinic-settings"

/* ─── Queries ─── */

export async function fetchClinicSettings(): Promise<ClinicSettings> {
  return api.get<ClinicSettings>("/clinic-settings")
}

export async function fetchClinicSettingsPublic(): Promise<PublicClinicSettings> {
  return api.get<PublicClinicSettings>("/clinic-settings/public")
}

/* ─── Mutations ─── */

export async function updateClinicSettings(
  data: UpdateClinicSettingsPayload,
): Promise<ClinicSettings> {
  return api.put<ClinicSettings>("/clinic-settings", data)
}
