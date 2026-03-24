import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HealthIndicatorService } from '@nestjs/terminus';
import { Redis } from 'ioredis';

@Injectable()
export class RedisHealthIndicator implements OnModuleDestroy {
  private readonly redis: Redis;
  private readonly logger = new Logger(RedisHealthIndicator.name);

  constructor(
    private readonly indicator: HealthIndicatorService,
    private readonly config: ConfigService,
  ) {
    this.redis = new Redis(
      this.config.get<string>('REDIS_URL') ?? 'redis://localhost:6379',
      { lazyConnect: true, connectTimeout: 2000, commandTimeout: 2000 },
    );
  }

  async check() {
    const session = this.indicator.check('redis');

    try {
      await this.redis.connect().catch(() => {
        /* already connected is fine */
      });
      const response = await this.redis.ping();

      if (response === 'PONG') {
        return session.up();
      }

      return session.down({ message: `Unexpected PING response: ${response}` });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`Redis health check failed: ${message}`);
      return session.down({ message });
    }
  }

  onModuleDestroy(): void {
    this.redis.disconnect();
  }
}
