/**
 * Shared application constants — single source of truth.
 */

/** bcrypt salt rounds for password hashing */
export const SALT_ROUNDS = 10;

/** JWT access token lifetime in seconds (15 minutes). */
export const ACCESS_TOKEN_EXPIRY = 900;

/** JWT refresh token lifetime in seconds (7 days). */
export const REFRESH_TOKEN_EXPIRY = 604_800;

/** Global rate limit: max requests per window. */
export const THROTTLE_LIMIT = 100;

/** Global rate limit: window duration in milliseconds (1 minute). */
export const THROTTLE_TTL = 60_000;

/** Max file upload size for KB files (20 MB). */
export const MAX_KB_FILE_SIZE = 20 * 1024 * 1024;

/** Max file upload size for receipts (10 MB). */
export const MAX_RECEIPT_FILE_SIZE = 10 * 1024 * 1024;

/** OTP rate limiting: max window failures before 1-hour lockout */
export const OTP_LOCKOUT_THRESHOLD = 3;

/** OTP rate limiting: lockout duration in seconds (1 hour) */
export const OTP_LOCKOUT_TTL_SECONDS = 3600;

/** OTP rate limiting: failed-windows counter TTL in seconds (2 hours) */
export const OTP_FAIL_WINDOWS_TTL_SECONDS = 7200;

// Re-export domain-specific constants
export * from './constants/index.js';
