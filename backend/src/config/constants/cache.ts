/** Cache TTL values in seconds. */
export const CACHE_TTL = {
  /** WhiteLabelConfig — 10 minutes (rarely changes) */
  WHITELABEL_CONFIG: 600,
  /** Active services list — 5 minutes */
  SERVICES_LIST: 300,
  /** Active categories list — 15 minutes */
  CATEGORIES_LIST: 900,
} as const;

/** Cache key prefixes. */
export const CACHE_KEYS = {
  WHITELABEL_CONFIG: 'cache:whitelabel:config',
  WHITELABEL_BRANDING: 'cache:whitelabel:branding',
  WHITELABEL_TIMEZONE: 'cache:whitelabel:timezone',
  /** Pattern: cache:whitelabel:key:{key} — per-key cache for getConfigByKey() */
  WHITELABEL_KEY_PREFIX: 'cache:whitelabel:key:',
  /** Glob pattern to invalidate all whitelabel caches at once */
  WHITELABEL_ALL_PATTERN: 'cache:whitelabel:*',
  SERVICES_ACTIVE: 'cache:services:active',
  CATEGORIES_ACTIVE: 'cache:categories:active',
} as const;
