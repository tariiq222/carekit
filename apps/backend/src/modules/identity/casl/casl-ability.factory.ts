import { Injectable } from '@nestjs/common';
import { AbilityBuilder, createMongoAbility, MongoAbility } from '@casl/ability';

export type AppAbility = MongoAbility;

// TODO(P1): differentiate OWNER (billing/plan) from ADMIN (day-to-day). Today
// the two role keys carry identical permission sets; consolidating them — or
// splitting OWNER off so it gains plan/billing scopes ADMIN cannot touch —
// is tracked separately and intentionally out of scope for this P0 fix.
const BUILT_IN: Record<string, Array<{ action: string; subject: string }>> = {
  SUPER_ADMIN: [{ action: 'manage', subject: 'all' }],
  // OWNER is the per-org top-level role (MembershipRole). It has the same
  // tenant-scoped permissions as ADMIN — full control over all tenant resources.
  // Super-admin platform access is gated by isSuperAdmin boolean, not this map.
  OWNER: [
    { action: 'manage', subject: 'User' },
    { action: 'manage', subject: 'Booking' },
    { action: 'manage', subject: 'Client' },
    { action: 'manage', subject: 'Employee' },
    { action: 'manage', subject: 'Invoice' },
    { action: 'manage', subject: 'Payment' },
    { action: 'manage', subject: 'Report' },
    { action: 'manage', subject: 'Setting' },
    { action: 'manage', subject: 'Department' },
    { action: 'manage', subject: 'Category' },
    { action: 'manage', subject: 'Service' },
    { action: 'manage', subject: 'Branch' },
    { action: 'manage', subject: 'Branding' },
  ],
  ADMIN: [
    { action: 'manage', subject: 'User' },
    { action: 'manage', subject: 'Booking' },
    { action: 'manage', subject: 'Client' },
    { action: 'manage', subject: 'Employee' },
    { action: 'manage', subject: 'Invoice' },
    { action: 'manage', subject: 'Payment' },
    { action: 'manage', subject: 'Report' },
    { action: 'manage', subject: 'Setting' },
    { action: 'manage', subject: 'Department' },
    { action: 'manage', subject: 'Category' },
    { action: 'manage', subject: 'Service' },
    { action: 'manage', subject: 'Branch' },
    { action: 'manage', subject: 'Branding' },
  ],
  RECEPTIONIST: [
    { action: 'manage', subject: 'Booking' },
    { action: 'manage', subject: 'Client' },
    { action: 'read', subject: 'Employee' },
    { action: 'read', subject: 'Invoice' },
  ],
  ACCOUNTANT: [
    { action: 'manage', subject: 'Invoice' },
    { action: 'manage', subject: 'Payment' },
    { action: 'read', subject: 'Booking' },
    { action: 'read', subject: 'Report' },
  ],
  EMPLOYEE: [
    { action: 'read', subject: 'Booking' },
    { action: 'read', subject: 'Client' },
    { action: 'update', subject: 'Booking' },
  ],
  CLIENT: [
    { action: 'read', subject: 'Booking' },
    { action: 'create', subject: 'Booking' },
    { action: 'read', subject: 'Invoice' },
  ],
};

/**
 * Input shape for `buildForUser`.
 *
 * `membershipRole` is the canonical per-organization role (`Membership.role`)
 * and MUST be used for any tenant-scoped authz decision. It is propagated
 * from the JWT `membershipRole` claim onto `req.user` by `JwtStrategy`.
 *
 * `role` is the legacy global `User.role` enum. Phase A of DB-08 left it in
 * place during JWT-rotation rollout; new code MUST NOT branch on it for
 * tenant authz. We accept it here only so callers without a tenant context
 * (super-admin platform surfaces, /auth/me, /tenants/register) can still
 * resolve a role, and as a transitional fallback for in-flight pre-rollout
 * tokens that lack `membershipRole`.
 */
export interface AbilitySubjectUser {
  /** Per-org role from `Membership.role`. Authoritative for tenant authz. */
  membershipRole?: string | null;
  /** @deprecated legacy global User.role; kept for super-admin / pre-rollout-token fallback only. */
  role?: string | null;
  customRole: { permissions: Array<{ action: string; subject: string }> } | null;
}

@Injectable()
export class CaslAbilityFactory {
  buildForUser(user: AbilitySubjectUser): AppAbility {
    const { can, build } = new AbilityBuilder<AppAbility>(createMongoAbility);
    if (user.customRole) {
      for (const p of user.customRole.permissions) can(p.action, p.subject);
    } else {
      // Canonical role for tenant-scoped authz is `Membership.role`. The
      // legacy `User.role` is a transition-only fallback and must NOT be
      // trusted when a per-org role is available — see Role precedence in
      // apps/backend/CLAUDE.md.
      const effectiveRole = user.membershipRole ?? user.role ?? '';
      for (const p of BUILT_IN[effectiveRole] ?? []) can(p.action, p.subject);
    }
    return build();
  }
}
