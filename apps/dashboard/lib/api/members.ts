/**
 * Members & Invitations API — CareKit Dashboard
 */

import { api } from "@/lib/api"
import type {
  Member,
  Invitation,
  MemberListQuery,
  InvitationListQuery,
  MembershipRole,
} from "@/lib/types/members"
import type { PaginatedResponse } from "@/lib/types/common"

export async function fetchMembers(
  query: MemberListQuery = {},
): Promise<PaginatedResponse<Member>> {
  return api.get<PaginatedResponse<Member>>("/dashboard/identity/members", {
    page: query.page ?? 1,
    limit: query.limit ?? 20,
    ...(query.role && { role: query.role }),
    ...(query.isActive !== undefined && { isActive: query.isActive }),
  })
}

export async function inviteMember(data: {
  email: string
  role: MembershipRole
}): Promise<{ invitationId: string }> {
  return api.post<{ invitationId: string }>("/dashboard/identity/members/invite", data)
}

export async function updateMemberRole(
  membershipId: string,
  data: { role: MembershipRole },
): Promise<void> {
  return api.patch<void>(`/dashboard/identity/members/${membershipId}/role`, data)
}

export async function deactivateMember(membershipId: string): Promise<void> {
  return api.patch<void>(`/dashboard/identity/members/${membershipId}/deactivate`)
}

export async function fetchInvitations(
  query: InvitationListQuery = {},
): Promise<PaginatedResponse<Invitation>> {
  return api.get<PaginatedResponse<Invitation>>("/dashboard/identity/members/invitations", {
    page: query.page ?? 1,
    limit: query.limit ?? 20,
  })
}

export async function revokeInvitation(invitationId: string): Promise<void> {
  return api.delete<void>(`/dashboard/identity/members/invitations/${invitationId}`)
}