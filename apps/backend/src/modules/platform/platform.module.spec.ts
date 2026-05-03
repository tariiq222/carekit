import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { ClsModule } from 'nestjs-cls';
import { PlatformModule } from './platform.module';
import { ListSubscriptionsHandler } from './admin/list-subscriptions/list-subscriptions.handler';
import { DatabaseModule } from '../../infrastructure/database';
import { RedisService } from '../../infrastructure/cache/redis.service';
import { MailModule } from '../../infrastructure/mail';

describe('PlatformModule', () => {
  it('resolves ListSubscriptionsHandler', async () => {
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
              JWT_ACCESS_SECRET: 'test-secret-for-platform-module-spec',
              // FinanceModule (imported by PlatformModule for refund flow)
              // pulls in MinioService → require MinIO env keys.
              MINIO_ENDPOINT: 'localhost',
              MINIO_PORT: 9000,
              MINIO_USE_SSL: 'false',
              MINIO_ACCESS_KEY: 'test',
              MINIO_SECRET_KEY: 'test',
              MINIO_BUCKET: 'deqah-test',
              MOYASAR_PLATFORM_SECRET_KEY: 'sk_test_placeholder',
              MOYASAR_PLATFORM_WEBHOOK_SECRET: 'whsec_test_placeholder',
              // SMTP_HOST intentionally absent — SmtpService logs a warning
              // and stays in the disabled-but-resolvable state.
            }),
          ],
        }),
        ClsModule.forRoot({ global: true, middleware: { mount: false } }),
        DatabaseModule,
        MailModule,
        PlatformModule,
      ],
    })
      // RedisService instantiates an ioredis client in its ctor; the bare
      // module test does not need a live connection — stub the provider.
      .overrideProvider(RedisService)
      .useValue({ getClient: () => ({ del: jest.fn() }) })
      .compile();
    expect(module.get(ListSubscriptionsHandler)).toBeDefined();
  });
});
