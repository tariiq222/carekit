import { BadRequestException, Injectable } from '@nestjs/common';
import { PlatformSettingsService } from '../settings/platform-settings.service';
import { UpdateNotificationDefaultsDto } from './update-notification-defaults.dto';

@Injectable()
export class UpdateNotificationDefaultsHandler {
  constructor(private readonly settings: PlatformSettingsService) {}

  async execute(dto: UpdateNotificationDefaultsDto, actorSub: string): Promise<void> {
    if (dto.defaultChannels !== undefined) {
      await this.settings.set('notifications.defaultChannels', dto.defaultChannels, actorSub);
    }
    if (dto.quietHours !== undefined) {
      try { Intl.DateTimeFormat(undefined, { timeZone: dto.quietHours.timezone }); }
      catch { throw new BadRequestException(`Invalid timezone: ${dto.quietHours.timezone}`); }
      await this.settings.set('notifications.quietHours', dto.quietHours, actorSub);
    }
    if (dto.fcm !== undefined) {
      if (dto.fcm.serverKey !== undefined) await this.settings.set('notifications.fcm.serverKey', dto.fcm.serverKey, actorSub);
      if (dto.fcm.projectId !== undefined) await this.settings.set('notifications.fcm.projectId', dto.fcm.projectId, actorSub);
      if (dto.fcm.clientEmail !== undefined) await this.settings.set('notifications.fcm.clientEmail', dto.fcm.clientEmail, actorSub);
    }
  }
}
