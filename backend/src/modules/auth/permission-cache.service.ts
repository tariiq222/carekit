import { Inject, Injectable } from '@nestjs/common';
import { Redis } from 'ioredis';
import { REDIS_CLIENT } from '../../common/redis/redis.constants.js';

const PERM_CACHE_PREFIX = 'perm:user:';
const PERM_CACHE_TTL = 900; // matches access token lifetime

@Injectable()
export class PermissionCacheService {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async get(userId: string): Promise<Set<string> | null> {
    const cached = await this.redis.get(`${PERM_CACHE_PREFIX}${userId}`);
    if (!cached) return null;
    try {
      const arr = JSON.parse(cached) as string[];
      return new Set(arr);
    } catch {
      return null;
    }
  }

  async set(userId: string, permissions: Set<string>): Promise<void> {
    await this.redis.set(
      `${PERM_CACHE_PREFIX}${userId}`,
      JSON.stringify(Array.from(permissions)),
      'EX',
      PERM_CACHE_TTL,
    );
  }

  async invalidate(userId: string): Promise<void> {
    await this.redis.del(`${PERM_CACHE_PREFIX}${userId}`);
  }
}
