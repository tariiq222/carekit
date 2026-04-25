import { Module } from '@nestjs/common';
import { AuthenticaModule } from '../../../infrastructure/authentica';
import { EmailChannelAdapter } from './email-channel.adapter';
import { SmsChannelAdapter } from './sms-channel.adapter';
import { NotificationChannelRegistry } from './notification-channel-registry';

@Module({
  imports: [AuthenticaModule],
  providers: [EmailChannelAdapter, SmsChannelAdapter, NotificationChannelRegistry],
  exports: [NotificationChannelRegistry],
})
export class NotificationChannelModule {}
