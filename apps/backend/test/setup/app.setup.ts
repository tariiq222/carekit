import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import SuperTest from 'supertest';
import { AppModule } from '../../src/app.module';
import { FcmService } from '../../src/infrastructure/mail/fcm.service';
import { SmtpService } from '../../src/infrastructure/mail/smtp.service';
import { EmbeddingAdapter } from '../../src/infrastructure/ai/embedding.adapter';
import { ChatAdapter } from '../../src/infrastructure/ai/chat.adapter';
import { MinioService } from '../../src/infrastructure/storage/minio.service';
import { ensureTestUsers } from './auth.helper';

const TEST_JWT_ACCESS_SECRET = 'test-access-secret-32chars-min';
const TEST_JWT_REFRESH_SECRET = 'test-refresh-secret-32chars-min';
const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgresql://carekit:carekit_dev_password@127.0.0.1:5999/carekit_test?schema=public';

let cachedApp: INestApplication | null = null;

export async function createTestApp(): Promise<{
  app: INestApplication;
  request: SuperTest.Agent;
}> {
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  process.env.REDIS_HOST = 'localhost';
  process.env.REDIS_PORT = '5380';
  process.env.OPENAI_API_KEY = 'test-key';
  process.env.OPENROUTER_API_KEY = 'test-key';
  process.env.MOYASAR_API_KEY = 'test-key';
  process.env.FCM_PROJECT_ID = 'test-project';
  process.env.SMTP_HOST = 'localhost';
  process.env.SMTP_PORT = '1025';
  process.env.LICENSE_SERVER_URL = 'http://localhost:9999';
  process.env.MINIO_ENDPOINT = 'localhost';
  process.env.MINIO_PORT = '9000';
  process.env.MINIO_ACCESS_KEY = 'minioadmin';
  process.env.MINIO_SECRET_KEY = 'minioadmin123';
  process.env.MINIO_BUCKET = 'carekit';
  process.env.JWT_ACCESS_SECRET = TEST_JWT_ACCESS_SECRET;
  process.env.JWT_REFRESH_SECRET = TEST_JWT_REFRESH_SECRET;
  process.env.JWT_ACCESS_TTL = '15m';
  process.env.JWT_REFRESH_TTL = '30d';

  await ensureTestUsers();

  if (cachedApp) {
    return { app: cachedApp, request: SuperTest(cachedApp.getHttpServer()) };
  }

  const moduleRef: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(ConfigService)
    .useValue({
      get: (key: string) => {
        const map: Record<string, string> = {
          DATABASE_URL: TEST_DATABASE_URL,
          JWT_ACCESS_SECRET: TEST_JWT_ACCESS_SECRET,
          JWT_REFRESH_SECRET: TEST_JWT_REFRESH_SECRET,
          JWT_ACCESS_TTL: '15m',
          JWT_REFRESH_TTL: '30d',
          REDIS_HOST: 'localhost',
          REDIS_PORT: '5380',
          OPENAI_API_KEY: 'test-key',
          OPENROUTER_API_KEY: 'test-key',
          MOYASAR_API_KEY: 'test-key',
          FCM_PROJECT_ID: 'test-project',
          SMTP_HOST: 'localhost',
          SMTP_PORT: '1025',
          LICENSE_SERVER_URL: 'http://localhost:9999',
          MINIO_ENDPOINT: 'localhost',
          MINIO_PORT: '9000',
          MINIO_ACCESS_KEY: 'minioadmin',
          MINIO_SECRET_KEY: 'minioadmin123',
          MINIO_BUCKET: 'carekit',
        };
        return map[key];
      },
      getOrThrow: (key: string) => {
        const map: Record<string, string> = {
          DATABASE_URL: TEST_DATABASE_URL,
          JWT_ACCESS_SECRET: TEST_JWT_ACCESS_SECRET,
          JWT_REFRESH_SECRET: TEST_JWT_REFRESH_SECRET,
          JWT_ACCESS_TTL: '15m',
          JWT_REFRESH_TTL: '30d',
          REDIS_HOST: 'localhost',
          REDIS_PORT: '5380',
          OPENAI_API_KEY: 'test-key',
          OPENROUTER_API_KEY: 'test-key',
          MOYASAR_API_KEY: 'test-key',
          FCM_PROJECT_ID: 'test-project',
          SMTP_HOST: 'localhost',
          SMTP_PORT: '1025',
          LICENSE_SERVER_URL: 'http://localhost:9999',
          MINIO_ENDPOINT: 'localhost',
          MINIO_PORT: '9000',
          MINIO_ACCESS_KEY: 'minioadmin',
          MINIO_SECRET_KEY: 'minioadmin123',
          MINIO_BUCKET: 'carekit',
        };
        const val = map[key];
        if (!val) throw new Error(`Config key ${key} not found`);
        return val;
      },
    })
    .overrideProvider(FcmService)
    .useValue({ sendPush: jest.fn().mockResolvedValue(undefined) })
    .overrideProvider(SmtpService)
    .useValue({ send: jest.fn().mockResolvedValue(undefined), sendTemplate: jest.fn().mockResolvedValue(undefined) })
    .overrideProvider(EmbeddingAdapter)
    .useValue({ embed: jest.fn().mockResolvedValue(new Array(1536).fill(0)) })
    .overrideProvider(ChatAdapter)
    .useValue({
      isAvailable: () => true,
      complete: jest.fn(async (messages: Array<{ role: string; content: string }>) => {
        const last = messages[messages.length - 1]?.content ?? '';
        return `test reply for: ${last}`;
      }),
      stream: jest.fn(async function* () {
        yield 'test ';
        yield 'reply';
      }),
    })
    .overrideProvider(MinioService)
    .useValue({
      upload: jest.fn().mockResolvedValue({ url: 'http://localhost:5200/carekit/test.pdf' }),
      delete: jest.fn().mockResolvedValue(undefined),
      getPresignedUrl: jest.fn().mockResolvedValue('http://localhost:5200/carekit/test.pdf'),
    })
    .compile();

  const app = moduleRef.createNestApplication();
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  await app.init();
  cachedApp = app;

  return { app, request: SuperTest(app.getHttpServer()) };
}

export async function closeTestApp(): Promise<void> {
  if (cachedApp) {
    await cachedApp.close();
    cachedApp = null;
  }
}