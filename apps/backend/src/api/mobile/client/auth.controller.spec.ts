import 'reflect-metadata';
import {
  THROTTLER_LIMIT,
  THROTTLER_TTL,
} from '@nestjs/throttler/dist/throttler.constants';
import { MobileClientAuthController } from './auth.controller';

/**
 * The @Throttle decorator stores per-name (default: ...) metadata using keys
 * shaped like "THROTTLER:TTL" + name and "THROTTLER:LIMIT" + name on the method
 * function itself. We read the "default" entries to verify each mobile OTP
 * endpoint has a stricter limit than the global 300/min in app.module.ts.
 */
function readThrottle(handler: object) {
  const ttl = Reflect.getMetadata(`${THROTTLER_TTL}default`, handler) as
    | number
    | undefined;
  const limit = Reflect.getMetadata(`${THROTTLER_LIMIT}default`, handler) as
    | number
    | undefined;
  return { ttl, limit };
}

describe('MobileClientAuthController — rate limiting', () => {
  it('register endpoint is rate-limited at 3 requests / 60s', () => {
    const { ttl, limit } = readThrottle(
      MobileClientAuthController.prototype.registerUser,
    );
    expect(ttl).toBe(60_000);
    expect(limit).toBe(3);
  });

  it('request-login-otp endpoint is rate-limited at 3 requests / 60s', () => {
    const { ttl, limit } = readThrottle(
      MobileClientAuthController.prototype.requestLoginOtp,
    );
    expect(ttl).toBe(60_000);
    expect(limit).toBe(3);
  });

  it('verify-otp endpoint is rate-limited at 5 requests / 60s', () => {
    const { ttl, limit } = readThrottle(
      MobileClientAuthController.prototype.verifyMobileOtp,
    );
    expect(ttl).toBe(60_000);
    expect(limit).toBe(5);
  });
});
