/** Default system roles — these cannot be deleted */
export const SYSTEM_ROLES = {
  SUPER_ADMIN: 'super_admin',
  RECEPTIONIST: 'receptionist',
  ACCOUNTANT: 'accountant',
  PRACTITIONER: 'practitioner',
  PATIENT: 'patient',
} as const;

export type SystemRole = (typeof SYSTEM_ROLES)[keyof typeof SYSTEM_ROLES];
