import { Request } from 'express';
import { SecuritySettingsController } from './security-settings.controller';
import { PlatformSettingsService } from '../../modules/platform/settings/platform-settings.service';
import { LogPlatformSettingUpdateHandler } from '../../modules/platform/admin/log-platform-setting-update/log-platform-setting-update.handler';

describe('SecuritySettingsController', () => {
  let controller: SecuritySettingsController;
  let mockSettings: Partial<PlatformSettingsService>;
  let mockLogHandler: { execute: jest.Mock };
  let req: Request;

  beforeEach(() => {
    mockSettings = {
      get: jest.fn(),
      set: jest.fn(),
    };
    mockLogHandler = { execute: jest.fn().mockResolvedValue(undefined) };
    controller = new SecuritySettingsController(
      mockSettings as PlatformSettingsService,
      mockLogHandler as unknown as LogPlatformSettingUpdateHandler,
    );
    req = { ip: '1.2.3.4', socket: { remoteAddress: '1.2.3.4' }, headers: { 'user-agent': 'jest' } } as unknown as Request;
  });

  describe('getSettings', () => {
    it('returns default values when settings are null', async () => {
      mockSettings.get = jest.fn().mockResolvedValue(null);

      const result = await controller.getSettings();

      expect(result).toEqual({
        sessionTtlMinutes: 60,
        require2fa: false,
        ipAllowlist: [],
      });
    });

    it('returns actual values when settings exist', async () => {
      mockSettings.get = jest.fn()
        .mockResolvedValueOnce(120)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(['192.168.1.1', '10.0.0.1']);

      const result = await controller.getSettings();

      expect(result).toEqual({
        sessionTtlMinutes: 120,
        require2fa: true,
        ipAllowlist: ['192.168.1.1', '10.0.0.1'],
      });
    });

    it('uses correct settings keys', async () => {
      mockSettings.get = jest.fn().mockResolvedValue(null);

      await controller.getSettings();

      expect(mockSettings.get).toHaveBeenCalledWith('security.session.superAdminTtlMinutes');
      expect(mockSettings.get).toHaveBeenCalledWith('security.twoFactor.required');
      expect(mockSettings.get).toHaveBeenCalledWith('security.ipAllowlist');
    });
  });

  describe('updateSettings', () => {
    it('updates sessionTtlMinutes', async () => {
      mockSettings.get = jest.fn().mockResolvedValue(60); // different from 180
      mockSettings.set = jest.fn().mockResolvedValue(undefined);
      const user = { sub: 'user-1' } as never;

      await controller.updateSettings({ sessionTtlMinutes: 180 }, user, req);

      expect(mockSettings.set).toHaveBeenCalledWith('security.session.superAdminTtlMinutes', 180, 'user-1');
    });

    it('updates require2fa', async () => {
      mockSettings.get = jest.fn().mockResolvedValue(false); // different from true
      mockSettings.set = jest.fn().mockResolvedValue(undefined);
      const user = { sub: 'user-1' } as never;

      await controller.updateSettings({ require2fa: true }, user, req);

      expect(mockSettings.set).toHaveBeenCalledWith('security.twoFactor.required', true, 'user-1');
    });

    it('updates ipAllowlist', async () => {
      mockSettings.get = jest.fn().mockResolvedValue([]); // different from ['1.2.3.4']
      mockSettings.set = jest.fn().mockResolvedValue(undefined);
      const user = { sub: 'user-1' } as never;

      await controller.updateSettings({ ipAllowlist: ['1.2.3.4'] }, user, req);

      expect(mockSettings.set).toHaveBeenCalledWith('security.ipAllowlist', ['1.2.3.4'], 'user-1');
    });

    it('updates multiple fields at once', async () => {
      mockSettings.get = jest.fn().mockResolvedValue(null); // null !== any value = always writes
      mockSettings.set = jest.fn().mockResolvedValue(undefined);
      const user = { sub: 'user-1' } as never;

      await controller.updateSettings({
        sessionTtlMinutes: 240,
        require2fa: true,
        ipAllowlist: ['5.6.7.8'],
      }, user, req);

      expect(mockSettings.set).toHaveBeenCalledTimes(3);
    });

    it('ignores undefined fields', async () => {
      mockSettings.get = jest.fn().mockResolvedValue(null);
      mockSettings.set = jest.fn().mockResolvedValue(undefined);
      const user = { sub: 'user-1' } as never;

      await controller.updateSettings({}, user, req);

      expect(mockSettings.set).not.toHaveBeenCalled();
    });

    it('returns updated true', async () => {
      mockSettings.get = jest.fn().mockResolvedValue(60); // different from 90
      mockSettings.set = jest.fn().mockResolvedValue(undefined);
      const user = { sub: 'user-1' } as never;

      const result = await controller.updateSettings({ sessionTtlMinutes: 90 }, user, req);

      expect(result).toEqual({ updated: true });
    });
  });

  describe('audit logging', () => {
    it('writes a PLATFORM_SETTING_UPDATED row per changed security key', async () => {
      mockSettings.get = jest.fn().mockResolvedValue(60); // previous TTL
      mockSettings.set = jest.fn().mockResolvedValue(undefined);
      const user = { sub: 'user-1' } as never;

      await controller.updateSettings({ sessionTtlMinutes: 30 }, user, req);

      expect(mockLogHandler.execute).toHaveBeenCalledWith(expect.objectContaining({
        superAdminUserId: 'user-1',
        settingKey: 'security.session.superAdminTtlMinutes',
        previousValue: 60,
        nextValue: 30,
        ipAddress: '1.2.3.4',
        userAgent: 'jest',
      }));
    });

    it('treats array value-equality as no-op (deep equality on ipAllowlist)', async () => {
      mockSettings.get = jest.fn().mockResolvedValue(['1.2.3.4/32']); // same as next
      mockSettings.set = jest.fn().mockResolvedValue(undefined);
      const user = { sub: 'user-1' } as never;

      await controller.updateSettings({ ipAllowlist: ['1.2.3.4/32'] }, user, req);

      expect(mockSettings.set).not.toHaveBeenCalled();
      expect(mockLogHandler.execute).not.toHaveBeenCalled();
    });

    it('writes a row when ipAllowlist contents differ', async () => {
      mockSettings.get = jest.fn().mockResolvedValue(['1.2.3.4/32']);
      mockSettings.set = jest.fn().mockResolvedValue(undefined);
      const user = { sub: 'user-1' } as never;

      await controller.updateSettings({ ipAllowlist: ['5.6.7.8/32'] }, user, req);

      expect(mockSettings.set).toHaveBeenCalledTimes(1);
      expect(mockLogHandler.execute).toHaveBeenCalledTimes(1);
    });
  });
});
