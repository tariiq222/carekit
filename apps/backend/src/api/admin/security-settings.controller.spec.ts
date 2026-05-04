import { SecuritySettingsController } from './security-settings.controller';
import { PlatformSettingsService } from '../../modules/platform/settings/platform-settings.service';

describe('SecuritySettingsController', () => {
  let controller: SecuritySettingsController;
  let mockSettings: Partial<PlatformSettingsService>;

  beforeEach(() => {
    mockSettings = {
      get: jest.fn(),
      set: jest.fn(),
    };
    controller = new SecuritySettingsController(mockSettings as PlatformSettingsService);
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
      mockSettings.set = jest.fn().mockResolvedValue(undefined);
      const user = { sub: 'user-1' } as never;

      await controller.updateSettings({ sessionTtlMinutes: 180 }, user);

      expect(mockSettings.set).toHaveBeenCalledWith('security.session.superAdminTtlMinutes', 180, 'user-1');
    });

    it('updates require2fa', async () => {
      mockSettings.set = jest.fn().mockResolvedValue(undefined);
      const user = { sub: 'user-1' } as never;

      await controller.updateSettings({ require2fa: true }, user);

      expect(mockSettings.set).toHaveBeenCalledWith('security.twoFactor.required', true, 'user-1');
    });

    it('updates ipAllowlist', async () => {
      mockSettings.set = jest.fn().mockResolvedValue(undefined);
      const user = { sub: 'user-1' } as never;

      await controller.updateSettings({ ipAllowlist: ['1.2.3.4'] }, user);

      expect(mockSettings.set).toHaveBeenCalledWith('security.ipAllowlist', ['1.2.3.4'], 'user-1');
    });

    it('updates multiple fields at once', async () => {
      mockSettings.set = jest.fn().mockResolvedValue(undefined);
      const user = { sub: 'user-1' } as never;

      await controller.updateSettings({
        sessionTtlMinutes: 240,
        require2fa: true,
        ipAllowlist: ['5.6.7.8'],
      }, user);

      expect(mockSettings.set).toHaveBeenCalledTimes(3);
    });

    it('ignores undefined fields', async () => {
      mockSettings.set = jest.fn().mockResolvedValue(undefined);
      const user = { sub: 'user-1' } as never;

      await controller.updateSettings({}, user);

      expect(mockSettings.set).not.toHaveBeenCalled();
    });

    it('returns updated true', async () => {
      mockSettings.set = jest.fn().mockResolvedValue(undefined);
      const user = { sub: 'user-1' } as never;

      const result = await controller.updateSettings({ sessionTtlMinutes: 90 }, user);

      expect(result).toEqual({ updated: true });
    });
  });
});
