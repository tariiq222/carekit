import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { envValidationSchema } from './config/env.validation';
import { DatabaseModule } from './infrastructure/database';
import { MessagingModule } from './infrastructure/messaging.module';
import { StorageModule } from './infrastructure/storage';
import { MailModule } from './infrastructure/mail';
import { TenantMiddleware } from './common/tenant';
import { IdentityModule } from './modules/identity/identity.module';
import { PlatformModule } from './modules/platform/platform.module';
import { PeopleModule } from './modules/people/people.module';
import { MediaModule } from './modules/media/media.module';
import { OrganizationModule } from './modules/organization/organization.module';
import { FinanceModule } from './modules/finance/finance.module';

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
    DatabaseModule,
    MessagingModule,
    StorageModule,
    MailModule,
    IdentityModule,
    PlatformModule,
    PeopleModule,
    MediaModule,
    OrganizationModule,
    FinanceModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(TenantMiddleware).forRoutes('*');
  }
}
