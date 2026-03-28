/** Cache TTL values in seconds. */
export const CACHE_TTL = {
  /** WhiteLabelConfig — 5 minutes */
  WHITELABEL_CONFIG: 300,
  /** Active services list — 5 minutes */
  SERVICES_LIST: 300,
  /** Active categories list — 15 minutes */
  CATEGORIES_LIST: 900,
} as const;

/** Cache key prefixes. */
export const CACHE_KEYS = {
  WHITELABEL_CONFIG: 'cache:whitelabel:config',
  WHITELABEL_BRANDING: 'cache:whitelabel:branding',
  SERVICES_ACTIVE: 'cache:services:active',
  CATEGORIES_ACTIVE: 'cache:categories:active',
} as const;
