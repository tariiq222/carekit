import { Module } from '@nestjs/common';
import { PlatformSettingsModule } from '../settings/platform-settings.module';
import { GetNotificationDefaultsHandler } from './get-notification-defaults.handler';
import { UpdateNotificationDefaultsHandler } from './update-notification-defaults.handler';
import { LogPlatformSettingUpdateHandler } from '../admin/log-platform-setting-update/log-platform-setting-update.handler';

@Module({
  imports: [PlatformSettingsModule],
  providers: [GetNotificationDefaultsHandler, UpdateNotificationDefaultsHandler, LogPlatformSettingUpdateHandler],
  exports: [GetNotificationDefaultsHandler, UpdateNotificationDefaultsHandler],
})
export class NotificationsConfigModule {}
