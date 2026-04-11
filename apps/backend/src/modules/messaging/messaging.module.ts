import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';

import { PushService } from './channels/push/push.service.js';
import { PushChannel } from './channels/push/push.channel.js';
import { FcmTokensService } from './channels/push/fcm-tokens.service.js';
import { SmsService } from './channels/sms/sms.service.js';
import { SmsChannel } from './channels/sms/sms.channel.js';
import { EmailService } from './channels/email/email.service.js';
import { EmailProcessor } from './channels/email/email.processor.js';
import { EmailChannel } from './channels/email/email.channel.js';
import { EmailTemplatesService } from './email-templates/email-templates.service.js';
import { EmailTemplatesController } from './email-templates/email-templates.controller.js';
import { NotificationsInboxService } from './inbox/notifications-inbox.service.js';
import { NotificationsController } from './inbox/notifications.controller.js';
import { MessagingPreferencesService } from './core/messaging-preferences.service.js';
import { MessagingDispatcherService } from './core/messaging-dispatcher.service.js';
import { WhitelabelModule } from '../whitelabel/whitelabel.module.js';
import { ClinicSettingsModule } from '../clinic-settings/clinic-settings.module.js';
import { DEFAULT_JOB_OPTIONS, QUEUE_EMAIL } from '../../config/constants/queues.js';

@Module({
  imports: [
    WhitelabelModule,
    ClinicSettingsModule,
    BullModule.registerQueue({ name: QUEUE_EMAIL, defaultJobOptions: DEFAULT_JOB_OPTIONS }),
    // MailerModule is already registered globally by the legacy EmailModule —
    // do not call forRootAsync here to avoid duplicate registration.
  ],
  controllers: [NotificationsController, EmailTemplatesController],
  providers: [
    // Channels
    PushService,
    FcmTokensService,
    SmsService,
    EmailService,
    EmailProcessor,
    EmailTemplatesService,
    // Channel adapters (named injection tokens)
    PushChannel,
    SmsChannel,
    EmailChannel,
    { provide: 'PUSH_CHANNEL', useExisting: PushChannel },
    { provide: 'EMAIL_CHANNEL', useExisting: EmailChannel },
    { provide: 'SMS_CHANNEL', useExisting: SmsChannel },
    // Core
    MessagingPreferencesService,
    MessagingDispatcherService,
    // Inbox
    NotificationsInboxService,
  ],
  exports: [MessagingDispatcherService, NotificationsInboxService, FcmTokensService],
})
export class MessagingModule {}
