/**
 * Organization Profile API — CareKit Dashboard
 */

import { api } from "@/lib/api"
import type { OrgProfile, UpdateOrgProfilePayload } from "@/lib/types/organization-profile"

export async function fetchOrgProfile(): Promise<OrgProfile> {
  return api.get<OrgProfile>("/dashboard/organization/profile")
}

export async function updateOrgProfile(
  data: UpdateOrgProfilePayload,
): Promise<void> {
  return api.patch<void>("/dashboard/organization/profile", data)
}