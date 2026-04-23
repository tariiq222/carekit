/**
 * Members & Invitations Types — CareKit Dashboard
 */

export type MembershipRole = "OWNER" | "ADMIN" | "RECEPTIONIST" | "ACCOUNTANT" | "EMPLOYEE"

export interface Member {
  id: string
  userId: string
  role: MembershipRole
  isActive: boolean
  acceptedAt: string | null
  createdAt: string
}

export interface Invitation {
  id: string
  email: string
  role: MembershipRole
  status: "PENDING" | "ACCEPTED" | "REVOKED" | "EXPIRED"
  expiresAt: string
  createdAt: string
  acceptedAt: string | null
  revokedAt: string | null
}

export interface MemberListQuery {
  page?: number
  limit?: number
  role?: MembershipRole
  isActive?: boolean
}

export interface InvitationListQuery {
  page?: number
  limit?: number
}