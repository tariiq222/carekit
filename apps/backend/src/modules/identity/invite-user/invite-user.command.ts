import type { MembershipRole } from '@prisma/client';

export interface InviteUserCommand {
  /** Inviter user id (from JWT). */
  invitedByUserId: string;
  /** Inviting organization id (resolved from tenant context). */
  organizationId: string;
  email: string;
  role: MembershipRole;
  displayName?: string | null;
  jobTitle?: string | null;
}

export interface InviteUserResult {
  invitationId: string;
  /** PENDING after creation. We never expose whether the email already had a User. */
  status: 'PENDING';
  expiresAt: Date;
}
