/**
 * Role slug constants — single source of truth.
 * Matches slugs in the `roles` database table.
 */

export const ROLE_SUPER_ADMIN = 'super_admin';
export const ROLE_RECEPTIONIST = 'receptionist';
export const ROLE_ACCOUNTANT = 'accountant';
export const ROLE_PRACTITIONER = 'practitioner';
export const ROLE_PATIENT = 'patient';

/** Roles considered "admin" for dashboard access and scoping. */
export const ADMIN_ROLE_SLUGS = [
  ROLE_SUPER_ADMIN,
  ROLE_RECEPTIONIST,
  ROLE_ACCOUNTANT,
] as const;
