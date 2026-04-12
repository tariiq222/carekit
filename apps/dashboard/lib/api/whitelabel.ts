/**
 * WhiteLabel API — CareKit Dashboard
 */

import { api } from "@/lib/api"
import type { WhiteLabelConfig, UpdateWhitelabelPayload, PublicBranding } from "@/lib/types/whitelabel"

/* ─── Queries ─── */

export async function fetchWhitelabel(): Promise<WhiteLabelConfig> {
  return api.get<WhiteLabelConfig>("/dashboard/organization/branding")
}

export async function fetchPublicBranding(): Promise<PublicBranding> {
  return api.get<PublicBranding>("/public/branding")
}

/* ─── Mutations ─── */

export async function updateWhitelabel(
  data: UpdateWhitelabelPayload,
): Promise<WhiteLabelConfig> {
  return api.post<WhiteLabelConfig>("/dashboard/organization/branding", data)
}
