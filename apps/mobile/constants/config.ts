export const API_URL =
  process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';

/**
 * The tenant this binary is locked to. Defaults to dev DEFAULT_ORGANIZATION_ID.
 * Override per-environment via EXPO_PUBLIC_TENANT_ID. Sent as the X-Org-Id
 * header on every API call by services/api.ts.
 */
export const TENANT_ID =
  process.env.EXPO_PUBLIC_TENANT_ID ?? '00000000-0000-0000-0000-000000000001';

export const APP_NAME = 'سواء للإرشاد الأسري';
export const APP_SCHEME = 'sawa';

export const DEFAULT_LANGUAGE = 'ar';
export const SUPPORTED_LANGUAGES = ['ar', 'en'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];
