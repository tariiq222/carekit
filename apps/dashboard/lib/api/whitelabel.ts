/**
 * WhiteLabel API — CareKit Dashboard
 */

import { api } from "@/lib/api"
import type { WhiteLabelConfig, UpdateWhitelabelPayload, PublicBranding } from "@/lib/types/whitelabel"

/* ─── Queries ─── */

export async function fetchWhitelabel(): Promise<WhiteLabelConfig> {
  return api.get<WhiteLabelConfig>("/whitelabel")
}

export async function fetchPublicBranding(): Promise<PublicBranding> {
  return api.get<PublicBranding>("/whitelabel/public")
}

/* ─── Mutations ─── */

export async function updateWhitelabel(
  data: UpdateWhitelabelPayload,
): Promise<WhiteLabelConfig> {
  return api.put<WhiteLabelConfig>("/whitelabel", data)
}
