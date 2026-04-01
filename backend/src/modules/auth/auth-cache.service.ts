import { Inject, Injectable } from '@nestjs/common';
import { Redis } from 'ioredis';
import { REDIS_CLIENT } from '../../common/redis/redis.constants.js';
import type { UserPayload } from '../../common/types/user-payload.type.js';
import { ACCESS_TOKEN_EXPIRY } from '../../config/constants.js';

const AUTH_CACHE_PREFIX = 'auth:user:';
const AUTH_CACHE_LOCK_PREFIX = 'auth:user:lock:';
const AUTH_CACHE_TTL = ACCESS_TOKEN_EXPIRY; // matches access token lifetime
const AUTH_CACHE_LOCK_TTL = 5; // seconds — short lock to prevent stampede

@Injectable()
export class AuthCacheService {
  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async get(userId: string): Promise<UserPayload | null> {
    const cached = await this.redis.get(`${AUTH_CACHE_PREFIX}${userId}`);
    if (!cached) return null;
    try {
      return JSON.parse(cached) as UserPayload;
    } catch {
      return null;
    }
  }

  async set(userId: string, payload: UserPayload): Promise<void> {
    await this.redis.set(
      `${AUTH_CACHE_PREFIX}${userId}`,
      JSON.stringify(payload),
      'EX',
      AUTH_CACHE_TTL,
    );
  }

  async invalidate(userId: string): Promise<void> {
    await this.redis.del(`${AUTH_CACHE_PREFIX}${userId}`);
  }

  /**
   * M6: Acquire a short-lived lock to prevent cache stampede.
   * Returns true if the lock was acquired (caller should populate cache).
   * Returns false if another request is already populating the cache.
   */
  async acquirePopulateLock(userId: string): Promise<boolean> {
    const key = `${AUTH_CACHE_LOCK_PREFIX}${userId}`;
    // SET key value NX EX ttl — atomic acquire
    const result = await this.redis.set(key, '1', 'EX', AUTH_CACHE_LOCK_TTL, 'NX');
    return result === 'OK';
  }

  async releasePopulateLock(userId: string): Promise<void> {
    await this.redis.del(`${AUTH_CACHE_LOCK_PREFIX}${userId}`);
  }
}
