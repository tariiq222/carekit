import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';

describe('AppModule — ThrottlerModule wiring', () => {
  it('should resolve ThrottlerStorageRedisService as the storage provider', () => {
    const config = {
      getOrThrow: jest.fn((key) => {
        if (key === 'REDIS_HOST') return 'localhost';
        if (key === 'REDIS_PORT') return 6379;
        throw new Error(`Unexpected key: ${key}`);
      }),
      get: jest.fn((key) => {
        if (key === 'REDIS_DB') return 0;
        if (key === 'REDIS_PASSWORD') return undefined;
        return undefined;
      }),
    } as any;

    const storage = new ThrottlerStorageRedisService({
      host: config.getOrThrow('REDIS_HOST'),
      port: config.getOrThrow('REDIS_PORT'),
      db: config.get('REDIS_DB') ?? 0,
      password: config.get('REDIS_PASSWORD') || undefined,
    });

    expect(storage).toBeDefined();
    expect(storage).toBeInstanceOf(ThrottlerStorageRedisService);
  });
});
