/**
 * Well-known tenant identifiers and error codes.
 * Values must match prisma/migrations/*_saas01_organization_membership seed.
 */
export const DEFAULT_ORGANIZATION_ID = '00000000-0000-0000-0000-000000000001';
export const DEFAULT_ORGANIZATION_SLUG = 'default';

export const TENANT_CLS_KEY = 'tenant' as const;
export const SYSTEM_CONTEXT_CLS_KEY = 'systemContext' as const;

export const TENANT_ERROR_CODES = {
  RESOLUTION_FAILED: 'TENANT_RESOLUTION_FAILED',
  CROSS_TENANT_ACCESS: 'TENANT_CROSS_ACCESS',
  NOT_MEMBER: 'TENANT_NOT_MEMBER',
  ORG_SUSPENDED: 'TENANT_ORG_SUSPENDED',
} as const;

export type TenantEnforcementMode = 'off' | 'permissive' | 'strict';
