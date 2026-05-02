/**
 * useMemberships — SaaS-06
 *
 * Fetches the active organization memberships for the currently
 * authenticated user. Powers the tenant switcher: when the array has
 * more than one row, the switcher is rendered.
 */

import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api"

/* ─── Types ─── */

export interface MembershipOrganization {
  id: string
  slug: string
  nameAr: string
  nameEn: string | null
  status: string
}

export interface Membership {
  id: string
  organizationId: string
  role: string
  isActive: boolean
  // Per-org display profile (overrides User defaults within this org).
  displayName: string | null
  jobTitle: string | null
  avatarUrl: string | null
  organization: MembershipOrganization
}

/* ─── Query Key ─── */

export const membershipsQueryKey = ["me", "memberships"] as const

/* ─── Hook ─── */

export function useMemberships() {
  return useQuery<Membership[]>({
    queryKey: membershipsQueryKey,
    queryFn: () => api.get<Membership[]>("/auth/memberships"),
    staleTime: 5 * 60 * 1000, // 5 min — memberships rarely change
  })
}
