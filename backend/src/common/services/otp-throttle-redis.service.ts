import { Inject, Injectable, Logger } from '@nestjs/common';
import { Redis } from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.constants.js';
import {
  OTP_LOCKOUT_THRESHOLD,
  OTP_LOCKOUT_TTL_SECONDS,
  OTP_FAIL_WINDOWS_TTL_SECONDS,
} from '../../config/constants.js';

export interface OtpThrottleResult {
  allowed: boolean;
  remaining: number;
  lockedUntilMs?: number;
}

/** Prefix constants for Redis keys */
const KEY_PREFIX_RATE = 'otp:rate:';
const KEY_PREFIX_LOCKOUT = 'otp:lockout:';
const KEY_PREFIX_FAIL = 'otp:fail_windows:';

/**
 * Lua script for atomic INCR + PEXPIRE.
 * Returns the new count after increment.
 * KEYS[1] = rate key, ARGV[1] = TTL in milliseconds.
 */
const INCR_WITH_PEXPIRE_LUA = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
return count
`;

@Injectable()
export class OtpThrottleRedisService {
  private readonly logger = new Logger(OtpThrottleRedisService.name);

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  /**
   * Check if the email+route combination is within rate limits.
   * Uses atomic Lua script for INCR + PEXPIRE to prevent race conditions.
   */
  async check(
    email: string,
    routeKey: string,
    limit: number,
    ttlMs: number,
  ): Promise<OtpThrottleResult> {
    const normalizedEmail = email.toLowerCase();
    const lockoutKey = `${KEY_PREFIX_LOCKOUT}${normalizedEmail}:${routeKey}`;
    const rateKey = `${KEY_PREFIX_RATE}${normalizedEmail}:${routeKey}`;
    const failKey = `${KEY_PREFIX_FAIL}${normalizedEmail}:${routeKey}`;

    // 1. Check lockout
    const lockoutTtl = await this.redis.pttl(lockoutKey);
    if (lockoutTtl > 0) {
      return {
        allowed: false,
        remaining: 0,
        lockedUntilMs: Date.now() + lockoutTtl,
      };
    }

    // 2. Atomic increment rate counter via Lua script
    const count = (await this.redis.call(
      'EVAL',
      INCR_WITH_PEXPIRE_LUA,
      '1',
      rateKey,
      String(ttlMs),
    )) as number;

    // 3. If count exceeds limit, increment fail windows
    if (count > limit) {
      const failCount = await this.redis.incr(failKey);
      if (failCount === 1) {
        await this.redis.expire(failKey, OTP_FAIL_WINDOWS_TTL_SECONDS);
      }

      // If enough failed windows, set lockout
      if (failCount >= OTP_LOCKOUT_THRESHOLD) {
        await this.redis.set(
          lockoutKey,
          '1',
          'EX',
          OTP_LOCKOUT_TTL_SECONDS,
        );
        // Clean up the fail counter since lockout is now active
        await this.redis.del(failKey);

        return {
          allowed: false,
          remaining: 0,
          lockedUntilMs: Date.now() + OTP_LOCKOUT_TTL_SECONDS * 1000,
        };
      }

      return { allowed: false, remaining: 0 };
    }

    return { allowed: true, remaining: limit - count };
  }

  /** Reset fail-windows counter on successful action (e.g., correct OTP). */
  async markSuccess(email: string, routeKey: string): Promise<void> {
    const normalizedEmail = email.toLowerCase();
    const failKey = `${KEY_PREFIX_FAIL}${normalizedEmail}:${routeKey}`;

    try {
      await this.redis.del(failKey);
    } catch (err) {
      this.logger.warn('Failed to reset OTP fail counter', err);
    }
  }
}
