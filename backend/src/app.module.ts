import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { ThrottlerModule, ThrottlerGuard, ThrottlerStorage } from '@nestjs/throttler';
import { ThrottlerRedisStorage } from './common/services/throttler-redis-storage.js';
import { APP_GUARD, APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { DatabaseModule } from './database/database.module.js';
import { StorageModule } from './common/services/storage.module.js';
import { validate } from './config/env.validation.js';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter.js';
import { ResponseTransformInterceptor } from './common/interceptors/response-transform.interceptor.js';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor.js';
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

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate,
    }),
    BullModule.forRootAsync({
      useFactory: (configService: ConfigService) => ({
        connection: {
          url: configService.get<string>('REDIS_URL'),
        },
      }),
      inject: [ConfigService],
    }),
    ThrottlerModule.forRoot({
      throttlers: [
        {
          ttl: 60000,
          limit: 100,
        },
      ],
    }),
    // Redis storage is provided below for ThrottlerModule
    DatabaseModule,
    StorageModule,
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
    ProblemReportsModule,
    TasksModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
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
  ],
})
export class AppModule {}
