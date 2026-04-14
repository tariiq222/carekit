import { Module, NestModule, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { envValidationSchema } from './config/env.validation';
import { DatabaseModule } from './infrastructure/database';
import { MessagingModule } from './infrastructure/messaging.module';
import { AiInfraModule } from './infrastructure/ai';
import { StorageModule } from './infrastructure/storage';
import { MailModule } from './infrastructure/mail';
import { TenantMiddleware } from './common/tenant';
import { IdentityModule } from './modules/identity/identity.module';
import { PlatformModule } from './modules/platform/platform.module';
import { PeopleModule } from './modules/people/people.module';
import { MediaModule } from './modules/media/media.module';
import { OrgConfigModule } from './modules/org-config/org-config.module';
import { OrgExperienceModule } from './modules/org-experience/org-experience.module';
import { FinanceModule } from './modules/finance/finance.module';
import { BookingsModule } from './modules/bookings/bookings.module';
import { OpsModule } from './modules/ops/ops.module';
import { AiModule } from './modules/ai/ai.module';
import { CommsModule } from './modules/comms/comms.module';
import { MobileClientModule } from './api/mobile/client/mobile-client.module';
import { MobileEmployeeModule } from './api/mobile/employee/mobile-employee.module';
import { PublicModule } from './api/public/public.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      validationSchema: envValidationSchema,
      validationOptions: {
        abortEarly: false,
        allowUnknown: true,
      },
    }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }]),
    DatabaseModule,
    MessagingModule,
    AiInfraModule,
    StorageModule,
    MailModule,
    IdentityModule,
    PlatformModule,
    PeopleModule,
    MediaModule,
    OrgConfigModule,
    OrgExperienceModule,
    FinanceModule,
    BookingsModule,
    OpsModule,
    AiModule,
    CommsModule,
    MobileClientModule,
    MobileEmployeeModule,
    PublicModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(TenantMiddleware)
      .exclude(
        { path: 'api/v1/auth/refresh', method: RequestMethod.POST },
        { path: 'api/v1/auth/logout', method: RequestMethod.POST },
        { path: 'api/v1/public/(.*)', method: RequestMethod.ALL },
      )
      .forRoutes('*');
  }
}
