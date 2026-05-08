import { BadRequestException } from '@nestjs/common';
import { UpdateNotificationDefaultsHandler } from './update-notification-defaults.handler';
import { NotificationChannel } from './update-notification-defaults.dto';

const mockSettings = {
  get: jest.fn(),
  set: jest.fn(),
};

const mockLogHandler = {
  execute: jest.fn(),
};

describe('UpdateNotificationDefaultsHandler', () => {
  let handler: UpdateNotificationDefaultsHandler;

  beforeEach(() => {
    jest.clearAllMocks();
    handler = new UpdateNotificationDefaultsHandler(
      mockSettings as never,
      mockLogHandler as never,
    );
    // Default: get returns undefined (so all values are treated as changed)
    mockSettings.get.mockResolvedValue(undefined);
    mockSettings.set.mockResolvedValue(undefined);
  });

  describe('defaultChannels', () => {
    it('writes defaultChannels when provided', async () => {
      await handler.execute({
        dto: { defaultChannels: [NotificationChannel.EMAIL] },
        superAdminUserId: 'user-1',
        ipAddress: '1.2.3.4',
        userAgent: 'jest',
      });

      expect(mockSettings.set).toHaveBeenCalledWith(
        'notifications.defaultChannels',
        [NotificationChannel.EMAIL],
        'user-1',
        false,
      );
    });

    it('does nothing when dto is empty', async () => {
      await handler.execute({
        dto: {},
        superAdminUserId: 'user-1',
        ipAddress: '1.2.3.4',
        userAgent: 'jest',
      });

      expect(mockSettings.set).not.toHaveBeenCalled();
    });
  });

  describe('quietHours', () => {
    it('writes quietHours with valid timezone', async () => {
      await handler.execute({
        dto: { quietHours: { startHour: 22, endHour: 7, timezone: 'Asia/Riyadh' } },
        superAdminUserId: 'user-1',
        ipAddress: '1.2.3.4',
        userAgent: 'jest',
      });

      expect(mockSettings.set).toHaveBeenCalledWith(
        'notifications.quietHours',
        { startHour: 22, endHour: 7, timezone: 'Asia/Riyadh' },
        'user-1',
        false,
      );
    });

    it('throws BadRequestException for invalid timezone', async () => {
      await expect(
        handler.execute({
          dto: { quietHours: { startHour: 22, endHour: 7, timezone: 'Invalid/Zone' } },
          superAdminUserId: 'user-1',
          ipAddress: '1.2.3.4',
          userAgent: 'jest',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('fcm credentials', () => {
    it('writes fcm.serverKey, projectId and clientEmail when all provided', async () => {
      await handler.execute({
        dto: { fcm: { serverKey: 'key', projectId: 'proj', clientEmail: 'em@test.com' } },
        superAdminUserId: 'user-1',
        ipAddress: '1.2.3.4',
        userAgent: 'jest',
      });

      expect(mockSettings.set).toHaveBeenCalledWith('notifications.fcm.serverKey', 'key', 'user-1', true);
      expect(mockSettings.set).toHaveBeenCalledWith('notifications.fcm.projectId', 'proj', 'user-1', false);
      expect(mockSettings.set).toHaveBeenCalledWith('notifications.fcm.clientEmail', 'em@test.com', 'user-1', true);
    });

    it('writes only provided fcm fields', async () => {
      await handler.execute({
        dto: { fcm: { projectId: 'proj-only' } },
        superAdminUserId: 'user-1',
        ipAddress: '1.2.3.4',
        userAgent: 'jest',
      });

      expect(mockSettings.set).toHaveBeenCalledTimes(1);
      expect(mockSettings.set).toHaveBeenCalledWith('notifications.fcm.projectId', 'proj-only', 'user-1', false);
    });
  });

  describe('audit logging', () => {
    it('writes a PLATFORM_SETTING_UPDATED row per changed notifications key', async () => {
      mockSettings.get = jest.fn().mockResolvedValue(['EMAIL']); // previous channels
      mockSettings.set = jest.fn().mockResolvedValue(undefined);

      await handler.execute({
        dto: {
          defaultChannels: ['EMAIL', 'IN_APP'] as NotificationChannel[],
          quietHours: { startHour: 22, endHour: 7, timezone: 'Asia/Riyadh' },
        },
        superAdminUserId: 'user-1',
        ipAddress: '1.2.3.4',
        userAgent: 'jest',
      });

      expect(mockLogHandler.execute).toHaveBeenCalledWith(expect.objectContaining({
        settingKey: 'notifications.defaultChannels',
        superAdminUserId: 'user-1',
      }));
      expect(mockLogHandler.execute).toHaveBeenCalledWith(expect.objectContaining({
        settingKey: 'notifications.quietHours',
      }));
    });

    it('marks fcm.serverKey as secret in audit metadata', async () => {
      mockSettings.get = jest.fn().mockResolvedValue('old-secret');
      mockSettings.set = jest.fn().mockResolvedValue(undefined);

      await handler.execute({
        dto: { fcm: { serverKey: 'new-secret' } },
        superAdminUserId: 'user-1',
        ipAddress: '1.2.3.4',
        userAgent: 'jest',
      });

      expect(mockLogHandler.execute).toHaveBeenCalledWith(expect.objectContaining({
        settingKey: 'notifications.fcm.serverKey',
        settingIsSecret: true,
      }));
    });

    it('does NOT mark fcm.projectId as secret', async () => {
      mockSettings.get = jest.fn().mockResolvedValue('old-project');
      mockSettings.set = jest.fn().mockResolvedValue(undefined);

      await handler.execute({
        dto: { fcm: { projectId: 'new-project' } },
        superAdminUserId: 'user-1',
        ipAddress: '1.2.3.4',
        userAgent: 'jest',
      });

      expect(mockLogHandler.execute).toHaveBeenCalledWith(expect.objectContaining({
        settingKey: 'notifications.fcm.projectId',
        settingIsSecret: false,
      }));
    });

    it('skips audit log + set on no-op array update (deep equality on defaultChannels)', async () => {
      mockSettings.get = jest.fn().mockResolvedValue(['EMAIL', 'IN_APP']);
      mockSettings.set = jest.fn().mockResolvedValue(undefined);

      await handler.execute({
        dto: { defaultChannels: ['EMAIL', 'IN_APP'] as NotificationChannel[] },
        superAdminUserId: 'user-1',
        ipAddress: '1.2.3.4',
        userAgent: 'jest',
      });

      expect(mockSettings.set).not.toHaveBeenCalled();
      expect(mockLogHandler.execute).not.toHaveBeenCalled();
    });
  });
});
