import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { ClsModule } from 'nestjs-cls';
import { PlatformModule } from './platform.module';
import { ListFeatureFlagsHandler } from './feature-flags/list-feature-flags.handler';
import { DatabaseModule } from '../../infrastructure/database';
import { RedisService } from '../../infrastructure/cache/redis.service';

describe('PlatformModule', () => {
  it('resolves ListFeatureFlagsHandler', async () => {
    const module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [
            () => ({
              REDIS_HOST: 'localhost',
              REDIS_PORT: 6379,
              REDIS_DB: 0,
            }),
          ],
        }),
        ClsModule.forRoot({ global: true, middleware: { mount: false } }),
        DatabaseModule,
        PlatformModule,
      ],
    })
      // RedisService instantiates an ioredis client in its ctor; the bare
      // module test does not need a live connection — stub the provider.
      .overrideProvider(RedisService)
      .useValue({ getClient: () => ({ del: jest.fn() }) })
      .compile();
    expect(module.get(ListFeatureFlagsHandler)).toBeDefined();
  });
});
