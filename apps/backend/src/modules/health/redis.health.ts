import { Inject, Injectable, Logger } from '@nestjs/common';
import { HealthIndicatorService } from '@nestjs/terminus';
import { Redis } from 'ioredis';
import { REDIS_CLIENT } from '../../common/redis/redis.constants.js';

@Injectable()
export class RedisHealthIndicator {
  private readonly logger = new Logger(RedisHealthIndicator.name);

  constructor(
    private readonly indicator: HealthIndicatorService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async check() {
    const session = this.indicator.check('redis');

    try {
      const response = await this.redis.ping();

      if (response === 'PONG') {
        return session.up();
      }

      return session.down({ message: `Unexpected PING response: ${response}` });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`Redis health check failed: ${message}`);
      return session.down({ message });
    }
  }
}
