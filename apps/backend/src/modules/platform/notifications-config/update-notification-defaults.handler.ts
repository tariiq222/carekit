import { BadRequestException, Injectable } from '@nestjs/common';
import { PlatformSettingsService } from '../settings/platform-settings.service';
import { LogPlatformSettingUpdateHandler } from '../admin/log-platform-setting-update/log-platform-setting-update.handler';
import { UpdateNotificationDefaultsDto } from './update-notification-defaults.dto';

export interface UpdateNotificationDefaultsCommand {
  dto: UpdateNotificationDefaultsDto;
  superAdminUserId: string;
  ipAddress: string;
  userAgent: string;
}

const SECRET_KEYS = new Set([
  'notifications.fcm.serverKey',
  'notifications.fcm.clientEmail',
]);

@Injectable()
export class UpdateNotificationDefaultsHandler {
  constructor(
    private readonly settings: PlatformSettingsService,
    private readonly logHandler: LogPlatformSettingUpdateHandler,
  ) {}

  async execute(cmd: UpdateNotificationDefaultsCommand): Promise<void> {
    const { dto, superAdminUserId, ipAddress, userAgent } = cmd;

    const updates: Array<[string, unknown]> = [];

    if (dto.defaultChannels !== undefined) {
      updates.push(['notifications.defaultChannels', dto.defaultChannels]);
    }
    if (dto.quietHours !== undefined) {
      try { Intl.DateTimeFormat(undefined, { timeZone: dto.quietHours.timezone }); }
      catch { throw new BadRequestException(`Invalid timezone: ${dto.quietHours.timezone}`); }
      updates.push(['notifications.quietHours', dto.quietHours]);
    }
    if (dto.fcm !== undefined) {
      if (dto.fcm.serverKey !== undefined) updates.push(['notifications.fcm.serverKey', dto.fcm.serverKey]);
      if (dto.fcm.projectId !== undefined) updates.push(['notifications.fcm.projectId', dto.fcm.projectId]);
      if (dto.fcm.clientEmail !== undefined) updates.push(['notifications.fcm.clientEmail', dto.fcm.clientEmail]);
    }

    // Order: set then log. If logHandler.execute throws, the setting is written but
    // unaudited for that key — preferred over logging an unwritten change.
    for (const [key, nextValue] of updates) {
      const previousValue = await this.settings.get(key);
      if (this.valuesEqual(previousValue, nextValue)) continue;
      const isSecret = SECRET_KEYS.has(key);
      await this.settings.set(key, nextValue, superAdminUserId, isSecret);
      await this.logHandler.execute({
        superAdminUserId,
        settingKey: key,
        previousValue,
        nextValue,
        settingIsSecret: isSecret,
        ipAddress,
        userAgent,
      });
    }
  }

  private valuesEqual(a: unknown, b: unknown): boolean {
    if (a === b) return true;
    try {
      return JSON.stringify(a) === JSON.stringify(b);
    } catch {
      return false;
    }
  }
}
