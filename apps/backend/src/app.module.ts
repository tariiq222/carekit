import { join } from 'path';
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { I18nModule, AcceptLanguageResolver } from 'nestjs-i18n';
import { BullModule } from '@nestjs/bullmq';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ThrottlerRedisStorage } from './common/services/throttler-redis-storage.js';
import {
  THROTTLE_TTL,
  THROTTLE_LIMIT,
  DEFAULT_JOB_OPTIONS,
} from './config/constants.js';
import { REDIS_CLIENT } from './common/redis/redis.constants.js';
import Redis from 'ioredis';
import { APP_GUARD, APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { RedisModule } from './common/redis/redis.module.js';
import { DatabaseModule } from './database/database.module.js';
import { StorageModule } from './common/storage.module.js';
import { AiServiceModule } from './common/ai-service.module.js';
import { CacheModule } from './common/services/cache.module.js';
import { validate } from './config/env.validation.js';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter.js';
import { ResponseTransformInterceptor } from './common/interceptors/response-transform.interceptor.js';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor.js';
import { CorrelationIdMiddleware } from './common/middleware/correlation-id.middleware.js';
import { BranchIdNormalizerMiddleware } from './common/middleware/branch-id-normalizer.middleware.js';
import { StructuredLogger } from './common/services/structured-logger.service.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { RolesModule } from './modules/roles/roles.module.js';
import { PermissionsModule } from './modules/permissions/permissions.module.js';
import { UsersModule } from './modules/users/users.module.js';
import { BookingsModule } from './modules/bookings/bookings.module.js';
import { PaymentsModule } from './modules/payments/payments.module.js';
import { InvoicesModule } from './modules/invoices/invoices.module.js';
import { ServicesModule } from './modules/services/services.module.js';
import { PractitionersModule } from './modules/practitioners/practitioners.module.js';
import { ReportsModule } from './modules/reports/reports.module.js';
import { WhitelabelModule } from './modules/whitelabel/whitelabel.module.js';
import { ChatbotModule } from './modules/chatbot/chatbot.module.js';
import { RatingsModule } from './modules/ratings/ratings.module.js';
import { PatientsModule } from './modules/patients/patients.module.js';
import { AiModule } from './modules/ai/ai.module.js';
import { ZatcaModule } from './modules/zatca/zatca.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { ActivityLogModule } from './modules/activity-log/activity-log.module.js';
import { TasksModule } from './modules/tasks/tasks.module.js';
import { ClinicModule } from './modules/clinic/clinic.module.js';
import { CouponsModule } from './modules/coupons/coupons.module.js';
import { IntakeFormsModule } from './modules/intake-forms/intake-forms.module.js';
import { BranchesModule } from './modules/branches/branches.module.js';
import { IntegrationsModule } from './modules/integrations/integrations.module.js';
import { FeatureFlagsModule } from './modules/feature-flags/feature-flags.module.js';
import { LicenseModule } from './modules/license/license.module.js';
import { ClinicSettingsModule } from './modules/clinic-settings/clinic-settings.module.js';
import { ClinicIntegrationsModule } from './modules/clinic-integrations/clinic-integrations.module.js';
import { DepartmentsModule } from './modules/departments/departments.module.js';
import { GroupsModule } from './modules/groups/groups.module.js';
import { MessagingModule } from './modules/messaging/messaging.module.js';
import { QueueModule } from './common/queue/queue.module.js';
import { MetricsModule } from './common/metrics/metrics.module.js';
import { MetricsInterceptor } from './common/metrics/metrics.interceptor.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate,
    }),
    I18nModule.forRoot({
      fallbackLanguage: 'ar',
      loaderOptions: {
        // Use process.cwd() + src/i18n so this works in both ESM runtime and Jest/CommonJS
        path: join(process.cwd(), 'src', 'i18n'),
        watch: false,
      },
      resolvers: [AcceptLanguageResolver],
    }),
    RedisModule,
    BullModule.forRootAsync({
      useFactory: (configService: ConfigService) => ({
        connection: {
          url: configService.get<string>('REDIS_URL'),
        },
        defaultJobOptions: DEFAULT_JOB_OPTIONS,
      }),
      inject: [ConfigService],
    }),
    ThrottlerModule.forRootAsync({
      useFactory: (redis: Redis) => ({
        throttlers: [{ ttl: THROTTLE_TTL, limit: THROTTLE_LIMIT }],
        storage: new ThrottlerRedisStorage(redis),
      }),
      inject: [REDIS_CLIENT],
    }),
    DatabaseModule,
    StorageModule,
    AiServiceModule,
    CacheModule,
    QueueModule,
    ActivityLogModule,
    AuthModule,
    RolesModule,
    PermissionsModule,
    UsersModule,
    BookingsModule,
    PaymentsModule,
    InvoicesModule,
    ServicesModule,
    PractitionersModule,
    ReportsModule,
    WhitelabelModule,
    ChatbotModule,
    RatingsModule,
    PatientsModule,
    AiModule,
    ZatcaModule,
    HealthModule,
    MetricsModule,
    TasksModule,
    ClinicModule,
    CouponsModule,
    IntakeFormsModule,
    BranchesModule,
    IntegrationsModule,
    FeatureFlagsModule,
    LicenseModule,
    ClinicSettingsModule,
    ClinicIntegrationsModule,
    DepartmentsModule,
    GroupsModule,
    MessagingModule,
  ],
  controllers: [],
  providers: [
    StructuredLogger,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseTransformInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: MetricsInterceptor,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
    // Strip branchId from all requests when multi_branch feature is disabled.
    // Applies globally so every endpoint (bookings, practitioners, reports, etc.)
    // falls back to branch-agnostic queries automatically.
    consumer.apply(BranchIdNormalizerMiddleware).forRoutes('*');
  }
}
