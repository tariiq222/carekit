/**
 * Fallback timezone used when WhiteLabelConfig is unavailable.
 * The actual timezone is read dynamically from WhiteLabelConfig key 'timezone'.
 * This constant is only used as a safe default.
 */
export const CLINIC_TIMEZONE_DEFAULT = 'Asia/Riyadh';

/** @deprecated Use getClinicTimezone() from WhitelabelService instead. Kept for backward compat during migration. */
export const CLINIC_TIMEZONE = CLINIC_TIMEZONE_DEFAULT;
