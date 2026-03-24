import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import type { UserPayload } from '../../common/types/user-payload.type.js';

const AUTH_CACHE_PREFIX = 'auth:user:';
const AUTH_CACHE_TTL = 900; // 15 minutes — matches access token lifetime

@Injectable()
export class AuthCacheService implements OnModuleDestroy {
  private readonly redis: Redis;

  constructor(private readonly config: ConfigService) {
    this.redis = new Redis(
      this.config.get<string>('REDIS_URL') ?? 'redis://localhost:6379',
    );
  }

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

  onModuleDestroy() {
    this.redis.disconnect();
  }
}
