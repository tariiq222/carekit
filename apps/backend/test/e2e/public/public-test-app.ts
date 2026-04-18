import SuperTest from 'supertest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from '../../../src/app.module';
import { FcmService } from '../../../src/infrastructure/mail/fcm.service';
import { SmtpService } from '../../../src/infrastructure/mail/smtp.service';
import { EmbeddingAdapter } from '../../../src/infrastructure/ai/embedding.adapter';
import { ChatAdapter } from '../../../src/infrastructure/ai/chat.adapter';
import { SemanticSearchHandler } from '../../../src/modules/ai/semantic-search/semantic-search.handler';
import { MinioService } from '../../../src/infrastructure/storage/minio.service';
import { MoyasarApiClient } from '../../../src/modules/finance/moyasar-api/moyasar-api.client';
import { NotificationChannelRegistry } from '../../../src/modules/comms/notification-channel/notification-channel-registry';
import { RequestOtpHandler } from '../../../src/modules/identity/otp/request-otp.handler';
import { PrismaService } from '../../../src/infrastructure/database';
import * as bcrypt from 'bcryptjs';
import { OtpChannel, OtpPurpose } from '@prisma/client';

const TEST_JWT_ACCESS_SECRET = 'test-access-secret-32chars-min';
const TEST_JWT_REFRESH_SECRET = 'test-refresh-secret-32chars-min';
const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgresql://carekit:carekit_dev_password@127.0.0.1:5999/carekit_test?schema=public';

export const DETERMINISTIC_OTP = '777777';

const mockMoyasarPayment = {
  id: 'moyasar-pay-test-1',
  amount: 23000,
  currency: 'SAR',
  status: 'paid' as const,
  description: 'Booking payment',
  metadata: { invoiceId: '', bookingId: '' },
  redirectUrl: 'https://checkout.moyasar.com/pay/moyasar-pay-test-1',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

let cachedApp: INestApplication | null = null;

export interface PublicTestApp {
  request: SuperTest.Agent;
}

export async function createPublicTestApp(): Promise<PublicTestApp> {
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  process.env.REDIS_HOST = 'localhost';
  process.env.REDIS_PORT = '5380';
  process.env.OPENAI_API_KEY = 'test-key';
  process.env.OPENROUTER_API_KEY = 'test-key';
  process.env.MOYASAR_API_KEY = 'test-key';
  process.env.MOYASAR_SECRET_KEY = 'test-secret';
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

  const moduleRef: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(ConfigService)
    .useValue({
      get: (key: string) => {
        const map: Record<string, string | number> = {
          DATABASE_URL: TEST_DATABASE_URL,
          JWT_ACCESS_SECRET: TEST_JWT_ACCESS_SECRET,
          JWT_REFRESH_SECRET: TEST_JWT_REFRESH_SECRET,
          JWT_ACCESS_TTL: '15m',
          JWT_REFRESH_TTL: '30d',
          REDIS_HOST: 'localhost',
          REDIS_PORT: 5380,
          OPENAI_API_KEY: 'test-key',
          OPENROUTER_API_KEY: 'test-key',
          MOYASAR_API_KEY: 'test-key',
          MOYASAR_SECRET_KEY: 'test-secret',
          FCM_PROJECT_ID: 'test-project',
          SMTP_HOST: 'localhost',
          SMTP_PORT: 1025,
          LICENSE_SERVER_URL: 'http://localhost:9999',
          MINIO_ENDPOINT: 'localhost',
          MINIO_PORT: 9000,
          MINIO_ACCESS_KEY: 'minioadmin',
          MINIO_SECRET_KEY: 'minioadmin123',
          MINIO_BUCKET: 'carekit',
        };
        return map[key];
      },
      getOrThrow: (key: string) => {
        const val = ({} as Record<string, string>)[key];
        if (!val) throw new Error(`Config key ${key} not found`);
        return val;
      },
    })
    .overrideProvider(FcmService)
    .useValue({ sendPush: jest.fn().mockResolvedValue(undefined) })
    .overrideProvider(SmtpService)
    .useValue({
      isAvailable: () => true,
      sendMail: jest.fn().mockResolvedValue(undefined),
      send: jest.fn().mockResolvedValue(undefined),
      sendTemplate: jest.fn().mockResolvedValue(undefined),
    })
    .overrideProvider(EmbeddingAdapter)
    .useValue({
      isAvailable: () => true,
      embed: jest.fn().mockResolvedValue([new Array(1536).fill(0)]),
    })
    .overrideProvider(SemanticSearchHandler)
    .useValue({ execute: jest.fn().mockResolvedValue([]) })
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
      uploadFile: jest.fn().mockResolvedValue('http://localhost:9000/carekit/mocked-key'),
      deleteFile: jest.fn().mockResolvedValue(undefined),
      getSignedUrl: jest.fn().mockResolvedValue('http://localhost:9000/carekit/mocked-key?sig=x'),
      fileExists: jest.fn().mockResolvedValue(true),
    })
    .overrideProvider(MoyasarApiClient)
    .useValue({
      createPayment: jest.fn().mockResolvedValue(mockMoyasarPayment),
      toPaymentStatus: jest.fn().mockReturnValue('COMPLETED' as never),
      toPaymentMethod: jest.fn().mockReturnValue('ONLINE_CARD' as never),
    })
    .overrideProvider(RequestOtpHandler)
    .useFactory({
      factory: (prisma: PrismaService, registry: NotificationChannelRegistry) => {
        return new DeterministicOtpHandler(prisma, registry);
      },
      inject: [PrismaService, NotificationChannelRegistry],
    })
    .compile();

  const app = moduleRef.createNestApplication();
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  await app.init();
  cachedApp = app;

  return { request: SuperTest(app.getHttpServer()) };
}

export async function closePublicTestApp(): Promise<void> {
  if (cachedApp) {
    await cachedApp.close();
    cachedApp = null;
  }
}

class DeterministicOtpHandler {
  private readonly logger = new Logger(DeterministicOtpHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: NotificationChannelRegistry,
  ) {}

  async execute(dto: { identifier: string; channel: string; purpose: string }): Promise<{ success: boolean }> {
    if (dto.channel === 'EMAIL') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(dto.identifier)) {
        throw new BadRequestException('Invalid email address');
      }
    }

    const rawCode = DETERMINISTIC_OTP;
    const codeHash = await bcrypt.hash(rawCode, 10);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await this.prisma.$transaction(async (tx) => {
      await tx.otpCode.updateMany({
        where: {
          identifier: dto.identifier,
          purpose: dto.purpose as unknown as OtpPurpose,
          consumedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: { consumedAt: new Date() },
      });

      await tx.otpCode.create({
        data: {
          channel: dto.channel as OtpChannel,
          identifier: dto.identifier,
          codeHash,
          purpose: dto.purpose as unknown as OtpPurpose,
          expiresAt,
        },
      });
    });

    try {
      const channel = this.registry.resolve(dto.channel as OtpChannel);
      await channel.send(dto.identifier, rawCode);
    } catch (err) {
      this.logger.error(`Failed to send OTP via ${dto.channel} to ${dto.identifier}`, err);
    }

    return { success: true };
  }
}
