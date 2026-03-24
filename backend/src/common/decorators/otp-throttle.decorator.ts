import { SetMetadata } from '@nestjs/common';

export const OTP_THROTTLE_META = 'otp_throttle';

export interface OtpThrottleMeta {
  routeKey: string;
  limit: number;
  ttlMs: number;
}

/**
 * Marks a route for OTP-specific email-based rate limiting.
 * Works with EmailThrottleGuard which reads this metadata.
 *
 * @param routeKey - Unique identifier for the route (e.g., 'login', 'otp_send')
 * @param limit - Max requests per window
 * @param ttlMs - Window duration in milliseconds (default: 60 seconds)
 */
export const OtpThrottle = (
  routeKey: string,
  limit: number,
  ttlMs = 60_000,
): MethodDecorator =>
  SetMetadata(OTP_THROTTLE_META, { routeKey, limit, ttlMs });
