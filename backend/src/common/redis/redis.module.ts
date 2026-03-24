import { Global, Inject, Logger, Module, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import { REDIS_CLIENT } from './redis.constants.js';

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: (config: ConfigService): Redis => {
        const logger = new Logger('RedisModule');
        const url =
          config.get<string>('REDIS_URL') ?? 'redis://localhost:6379';
        logger.log('Creating shared Redis connection');
        const client = new Redis(url, { lazyConnect: false, maxRetriesPerRequest: 3 });
        client.on('error', (err: Error) =>
          logger.error(`Redis connection error: ${err.message}`),
        );
        client.on('connect', () => logger.log('Redis connected'));
        return client;
      },
      inject: [ConfigService],
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule implements OnModuleDestroy {
  private readonly logger = new Logger(RedisModule.name);

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  onModuleDestroy(): void {
    this.logger.log('Disconnecting shared Redis client');
    this.redis.disconnect();
  }
}
