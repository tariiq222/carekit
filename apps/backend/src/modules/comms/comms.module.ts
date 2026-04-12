import { Module, OnModuleInit } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database';
import { MessagingModule } from '../../infrastructure/messaging.module';
import { MailModule } from '../../infrastructure/mail/mail.module';
import { EventBusService } from '../../infrastructure/events';
import { SendPushHandler } from './send-push/send-push.handler';
import { SendSmsHandler } from './send-sms/send-sms.handler';
import { SendEmailHandler } from './send-email/send-email.handler';
import { SendNotificationHandler } from './send-notification/send-notification.handler';
import { CreateNotificationHandler } from './notifications/create-notification.handler';
import { ListNotificationsHandler } from './notifications/list-notifications.handler';
import { MarkReadHandler } from './notifications/mark-read.handler';
import { CreateConversationHandler } from './chat/create-conversation.handler';
import { CreateChatMessageHandler } from './chat/create-chat-message.handler';
import { ListConversationsHandler } from './chat/list-conversations.handler';
import { ListMessagesHandler } from './chat/list-messages.handler';
import { CreateEmailTemplateHandler } from './email-templates/create-email-template.handler';
import { UpdateEmailTemplateHandler } from './email-templates/update-email-template.handler';
import { GetEmailTemplateHandler } from './email-templates/get-email-template.handler';
import { ListEmailTemplatesHandler } from './email-templates/list-email-templates.handler';
import { OnBookingCancelledHandler } from './events/on-booking-cancelled.handler';
import { OnBookingReminderHandler } from './events/on-booking-reminder.handler';
import { OnPaymentFailedHandler } from './events/on-payment-failed.handler';
import { OnClientEnrolledHandler } from './events/on-client-enrolled.handler';

const handlers = [
  SendPushHandler,
  SendSmsHandler,
  SendEmailHandler,
  SendNotificationHandler,
  CreateNotificationHandler,
  ListNotificationsHandler,
  MarkReadHandler,
  CreateConversationHandler,
  CreateChatMessageHandler,
  ListConversationsHandler,
  ListMessagesHandler,
  CreateEmailTemplateHandler,
  UpdateEmailTemplateHandler,
  GetEmailTemplateHandler,
  ListEmailTemplatesHandler,
];

const eventHandlers = [
  OnBookingCancelledHandler,
  OnBookingReminderHandler,
  OnPaymentFailedHandler,
  OnClientEnrolledHandler,
];

@Module({
  imports: [DatabaseModule, MessagingModule, MailModule],
  providers: [...handlers, ...eventHandlers],
  exports: [...handlers],
})
export class CommsModule implements OnModuleInit {
  constructor(
    private readonly eventBus: EventBusService,
    private readonly onBookingCancelled: OnBookingCancelledHandler,
    private readonly onBookingReminder: OnBookingReminderHandler,
    private readonly onPaymentFailed: OnPaymentFailedHandler,
    private readonly onClientEnrolled: OnClientEnrolledHandler,
  ) {}

  onModuleInit(): void {
    this.onBookingCancelled.register(this.eventBus);
    this.onBookingReminder.register(this.eventBus);
    this.onPaymentFailed.register(this.eventBus);
    this.onClientEnrolled.register(this.eventBus);
  }
}
