import { Module } from '@nestjs/common';
import { EmailChannelAdapter } from './email-channel.adapter';
import { NotificationChannelRegistry } from './notification-channel-registry';

@Module({
  providers: [EmailChannelAdapter, NotificationChannelRegistry],
  exports: [NotificationChannelRegistry],
})
export class NotificationChannelModule {}
