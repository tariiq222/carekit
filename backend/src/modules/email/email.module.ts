import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { MailerModule } from '@nestjs-modules/mailer';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EmailService } from './email.service.js';
import { EmailProcessor } from './email.processor.js';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'email' }),
    MailerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        transport: {
          host: config.get<string>('MAIL_HOST', 'localhost'),
          port: Number(config.get<string>('MAIL_PORT', '587')),
          auth: {
            user: config.get<string>('MAIL_USER', ''),
            pass: config.get<string>('MAIL_PASSWORD', ''),
          },
        },
        defaults: {
          from: config.get<string>(
            'MAIL_FROM',
            '"CareKit" <noreply@carekit.app>',
          ),
        },
      }),
    }),
  ],
  providers: [EmailService, EmailProcessor],
  exports: [EmailService],
})
export class EmailModule {}
