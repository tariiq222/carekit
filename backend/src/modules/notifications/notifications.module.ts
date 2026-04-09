import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller.js';
import { NotificationsService } from './notifications.service.js';
import { PushService } from './push.service.js';
import { SmsService } from './sms.service.js';
@Module({
  imports: [],
  controllers: [NotificationsController],
  providers: [NotificationsService, PushService, SmsService],
  exports: [NotificationsService, PushService, SmsService],
})
export class NotificationsModule {}
