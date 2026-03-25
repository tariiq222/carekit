import { Inject, Injectable, Logger } from '@nestjs/common';
import { ThrottlerStorage } from '@nestjs/throttler';
import { Redis } from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.constants.js';

@Injectable()
export class ThrottlerRedisStorage implements ThrottlerStorage {
  private readonly logger = new Logger(ThrottlerRedisStorage.name);

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    _throttlerName: string,
  ): Promise<{ totalHits: number; timeToExpire: number; isBlocked: boolean; timeToBlockExpire: number }> {
    try {
      return await this.doIncrement(key, ttl, limit, blockDuration);
    } catch (err) {
      this.logger.warn(
        `Redis throttle check failed, allowing request: ${err instanceof Error ? err.message : 'unknown'}`,
      );
      return { totalHits: 0, timeToExpire: 0, isBlocked: false, timeToBlockExpire: 0 };
    }
  }

  private async doIncrement(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
  ): Promise<{ totalHits: number; timeToExpire: number; isBlocked: boolean; timeToBlockExpire: number }> {
    const ttlSeconds = Math.ceil(ttl / 1000);
    const blockKey = `${key}:blocked`;

    // Check if currently blocked
    if (blockDuration > 0) {
      const blockTtl = await this.redis.ttl(blockKey);
      if (blockTtl > 0) {
        return {
          totalHits: limit + 1,
          timeToExpire: blockTtl * 1000,
          isBlocked: true,
          timeToBlockExpire: blockTtl * 1000,
        };
      }
    }

    const totalHits = await this.redis.incr(key);

    if (totalHits === 1) {
      await this.redis.expire(key, ttlSeconds);
    }

    const currentTtl = await this.redis.ttl(key);
    const timeToExpire = currentTtl > 0 ? currentTtl * 1000 : ttl;
    const isBlocked = totalHits > limit;
    let timeToBlockExpire = 0;

    if (isBlocked && blockDuration > 0) {
      const blockSeconds = Math.ceil(blockDuration / 1000);
      await this.redis.set(blockKey, '1', 'EX', blockSeconds);
      timeToBlockExpire = blockDuration;
    }

    return { totalHits, timeToExpire, isBlocked, timeToBlockExpire };
  }
}
