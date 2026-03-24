import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ThrottlerStorage } from '@nestjs/throttler';
import type { ThrottlerStorageRecord } from '@nestjs/throttler';
import { Redis } from 'ioredis';

@Injectable()
export class ThrottlerRedisStorage implements ThrottlerStorage, OnModuleDestroy {
  private readonly redis: Redis;

  constructor(private readonly config: ConfigService) {
    this.redis = new Redis(this.config.get<string>('REDIS_URL') ?? 'redis://localhost:6379');
  }

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    _throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    const ttlSeconds = Math.ceil(ttl / 1000);

    const totalHits = await this.redis.incr(key);

    if (totalHits === 1) {
      await this.redis.expire(key, ttlSeconds);
    }

    const currentTtl = await this.redis.ttl(key);
    const timeToExpire = currentTtl > 0 ? currentTtl * 1000 : ttl;

    const isBlocked = totalHits > limit;
    let timeToBlockExpire = 0;

    if (isBlocked && blockDuration > 0) {
      const blockKey = `${key}:blocked`;
      const blockSeconds = Math.ceil(blockDuration / 1000);
      await this.redis.set(blockKey, '1', 'EX', blockSeconds);
      timeToBlockExpire = blockDuration;
    }

    return { totalHits, timeToExpire, isBlocked, timeToBlockExpire };
  }

  onModuleDestroy() {
    this.redis.disconnect();
  }
}
