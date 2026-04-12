import { ConfigService } from '@nestjs/config';

jest.mock('ioredis', () => {
  // Minimal stub — `import Redis from 'ioredis'` resolves to the default
  // export. We avoid opening a real socket and just return an object with
  // the lifecycle methods the service actually touches.
  const ctor = jest.fn().mockImplementation(() => ({
    ping: jest.fn().mockResolvedValue('PONG'),
    quit: jest.fn().mockResolvedValue('OK'),
  }));
  return { __esModule: true, default: ctor };
});

import { RedisService } from './redis.service';

/**
 * Unit-level contract for RedisService. We never open a real socket —
 * `buildOptions` is pure and the lifecycle hooks are exercised against a
 * stubbed client. Integration with a real Redis instance is covered by
 * e2e tests.
 */
describe('RedisService', () => {
  const makeConfig = (overrides: Record<string, unknown> = {}): ConfigService => {
    const values: Record<string, unknown> = {
      REDIS_HOST: 'localhost',
      REDIS_PORT: 6379,
      REDIS_DB: 0,
      ...overrides,
    };
    return {
      get: (key: string) => values[key],
      getOrThrow: (key: string) => {
        if (values[key] === undefined) throw new Error(`missing ${key}`);
        return values[key];
      },
    } as unknown as ConfigService;
  };

  it('builds connection options from env', () => {
    const service = new RedisService(makeConfig({ REDIS_PASSWORD: 'secret', REDIS_DB: 3 }));
    const opts = service.buildOptions();
    expect(opts.host).toBe('localhost');
    expect(opts.port).toBe(6379);
    expect(opts.password).toBe('secret');
    expect(opts.db).toBe(3);
    expect(opts.enableReadyCheck).toBe(true);
  });

  it('omits password when empty string', () => {
    const service = new RedisService(makeConfig({ REDIS_PASSWORD: '' }));
    expect(service.buildOptions().password).toBeUndefined();
  });

  it('pings on module init', async () => {
    const service = new RedisService(makeConfig());
    const pingSpy = jest
      .spyOn(service.getClient(), 'ping')
      .mockResolvedValue('PONG');
    await service.onModuleInit();
    expect(pingSpy).toHaveBeenCalledTimes(1);
    await service.getClient().quit().catch(() => undefined);
  });

  it('quits on module destroy', async () => {
    const service = new RedisService(makeConfig());
    const quitSpy = jest
      .spyOn(service.getClient(), 'quit')
      .mockResolvedValue('OK');
    await service.onModuleDestroy();
    expect(quitSpy).toHaveBeenCalledTimes(1);
  });

  it('defaults db to 0 when REDIS_DB is not set', () => {
    const service = new RedisService(makeConfig({ REDIS_DB: undefined }));
    expect(service.buildOptions().db).toBe(0);
  });
});
