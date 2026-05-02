export interface AcceptInvitationCommand {
  token: string;
  /** Used only if the invited email has no existing User. */
  password?: string;
  name?: string;
}

export interface AcceptInvitationResult {
  membershipId: string;
  organizationId: string;
  /** The user already existed (true) or was created here (false). Returned for
   *  the success page only; the email itself never disclosed which branch.
   */
  userPreExisting: boolean;
}
