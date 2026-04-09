/** Cache TTL values in seconds. */
export const CACHE_TTL = {
  /** WhiteLabelConfig — 60 minutes (rarely changes) */
  WHITELABEL_CONFIG: 3600,
  /** LicenseConfig — 60 minutes (rarely changes) */
  LICENSE_CONFIG: 3600,
  /** ClinicSettings — 10 minutes */
  CLINIC_SETTINGS: 600,
  /** ClinicIntegrations — 30 minutes */
  CLINIC_INTEGRATIONS: 1800,
  /** Feature flags — 5 minutes */
  FEATURE_FLAGS: 300,
  /** Active services list — 5 minutes */
  SERVICES_LIST: 300,
  /** Active categories list — 15 minutes */
  CATEGORIES_LIST: 900,
} as const;

/** Cache key prefixes. */
export const CACHE_KEYS = {
  WHITELABEL: 'cache:whitelabel',
  WHITELABEL_PUBLIC: 'cache:whitelabel:public',
  LICENSE: 'cache:license',
  LICENSE_FEATURES: 'cache:license:features',
  CLINIC_SETTINGS: 'cache:clinic-settings',
  CLINIC_SETTINGS_PUBLIC: 'cache:clinic-settings:public',
  CLINIC_SETTINGS_TIMEZONE: 'cache:clinic-settings:timezone',
  CLINIC_INTEGRATIONS: 'cache:clinic-integrations',
  FEATURE_FLAGS_ALL: 'feature_flags:all',
  FEATURE_FLAGS_MAP: 'feature_flags:map',
  SERVICES_ACTIVE: 'cache:services:active',
  CATEGORIES_ACTIVE: 'cache:categories:active',
} as const;
