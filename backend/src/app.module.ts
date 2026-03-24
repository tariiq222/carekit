import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { ThrottlerModule, ThrottlerGuard, ThrottlerStorage } from '@nestjs/throttler';
import { ThrottlerRedisStorage } from './common/services/throttler-redis-storage.js';
import { THROTTLE_TTL, THROTTLE_LIMIT, DEFAULT_JOB_OPTIONS } from './config/constants.js';
import { APP_GUARD, APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { RedisModule } from './common/redis/redis.module.js';
import { DatabaseModule } from './database/database.module.js';
import { StorageModule } from './common/services/storage.module.js';
import { AiServiceModule } from './common/services/ai.module.js';
import { CacheModule } from './common/services/cache.module.js';
import { validate } from './config/env.validation.js';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter.js';
import { ResponseTransformInterceptor } from './common/interceptors/response-transform.interceptor.js';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor.js';
import { CorrelationIdMiddleware } from './common/middleware/correlation-id.middleware.js';
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
import { SpecialtiesModule } from './modules/specialties/specialties.module.js';
import { NotificationsModule } from './modules/notifications/notifications.module.js';
import { AiModule } from './modules/ai/ai.module.js';
import { ZatcaModule } from './modules/zatca/zatca.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { EmailModule } from './modules/email/email.module.js';
import { ActivityLogModule } from './modules/activity-log/activity-log.module.js';
import { ProblemReportsModule } from './modules/problem-reports/problem-reports.module.js';
import { TasksModule } from './modules/tasks/tasks.module.js';
import { QueueModule } from './common/queue/queue.module.js';
import { MetricsModule } from './common/metrics/metrics.module.js';
import { MetricsInterceptor } from './common/metrics/metrics.interceptor.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate,
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
      useFactory: (storage: ThrottlerStorage) => ({
        throttlers: [{ ttl: THROTTLE_TTL, limit: THROTTLE_LIMIT }],
        storage,
      }),
      inject: [ThrottlerStorage],
    }),
    DatabaseModule,
    StorageModule,
    AiServiceModule,
    CacheModule,
    QueueModule,
    EmailModule,
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
    SpecialtiesModule,
    NotificationsModule,
    AiModule,
    ZatcaModule,
    HealthModule,
    MetricsModule,
    ProblemReportsModule,
    TasksModule,
  ],
  controllers: [],
  providers: [
    StructuredLogger,
    {
      provide: ThrottlerStorage,
      useClass: ThrottlerRedisStorage,
    },
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
  }
}
