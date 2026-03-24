/** Cache TTL values in seconds. */
export const CACHE_TTL = {
  /** WhiteLabelConfig — 5 minutes */
  WHITELABEL_CONFIG: 300,
  /** Active services list — 5 minutes */
  SERVICES_LIST: 300,
  /** Active specialties list — 10 minutes */
  SPECIALTIES_LIST: 600,
} as const;

/** Cache key prefixes. */
export const CACHE_KEYS = {
  WHITELABEL_CONFIG: 'cache:whitelabel:config',
  WHITELABEL_BRANDING: 'cache:whitelabel:branding',
  SERVICES_ACTIVE: 'cache:services:active',
  SPECIALTIES_ACTIVE: 'cache:specialties:active',
} as const;
