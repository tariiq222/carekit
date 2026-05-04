import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { RedisService } from '../../src/infrastructure/cache/redis.service';

describe('Service Connections (integration)', () => {
  let redisService: RedisService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RedisService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              const map: Record<string, string> = {
                REDIS_HOST: process.env.REDIS_HOST ?? 'localhost',
                REDIS_PORT: process.env.REDIS_PORT ?? '6379',
              };
              return map[key];
            },
          },
        },
      ],
    }).compile();

    redisService = module.get<RedisService>(RedisService);
  });

  describe('Redis connection', () => {
    it('establishes connection to Redis', async () => {
      const isConnected = await redisService.ping();
      expect(isConnected).toBe('PONG');
    });

    it('sets and retrieves a value', async () => {
      const testKey = `integration:test:${Date.now()}:${Math.random()}`;
      await redisService.set(testKey, 'test-value', 60);
      const value = await redisService.get(testKey);
      expect(value).toBe('test-value');
      await redisService.del(testKey);
    });
  });
});