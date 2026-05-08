import { BadRequestException } from '@nestjs/common';
import { Request } from 'express';
import { BillingSettingsController } from './billing-settings.controller';
import { PlatformSettingsService } from '../../modules/platform/settings/platform-settings.service';
import { LogPlatformSettingUpdateHandler } from '../../modules/platform/admin/log-platform-setting-update/log-platform-setting-update.handler';

const ALL_BILLING_KEYS = [
  'billing.moyasar.platformSecretKey',
  'billing.moyasar.platformWebhookSecret',
  'billing.moyasar.publicKey',
  'billing.defaults.currency',
  'billing.defaults.taxPercent',
  'billing.defaults.trialDays',
] as const;

const SECRET_KEYS = new Set([
  'billing.moyasar.platformSecretKey',
  'billing.moyasar.platformWebhookSecret',
]);

describe('BillingSettingsController', () => {
  let controller: BillingSettingsController;
  let mockSettings: Partial<PlatformSettingsService>;
  let mockLogHandler: Partial<LogPlatformSettingUpdateHandler>;

  beforeEach(() => {
    mockSettings = {
      get: jest.fn(),
      set: jest.fn(),
    };
    mockLogHandler = {
      execute: jest.fn().mockResolvedValue(undefined),
    };
    controller = new BillingSettingsController(
      mockSettings as PlatformSettingsService,
      mockLogHandler as LogPlatformSettingUpdateHandler,
    );
  });

  describe('SECRET_KEYS constant', () => {
    it('contains moyasar secret keys', () => {
      expect(SECRET_KEYS.has('billing.moyasar.platformSecretKey')).toBe(true);
      expect(SECRET_KEYS.has('billing.moyasar.platformWebhookSecret')).toBe(true);
    });

    it('does not contain non-secret keys', () => {
      expect(SECRET_KEYS.has('billing.defaults.currency')).toBe(false);
      expect(SECRET_KEYS.has('billing.defaults.taxPercent')).toBe(false);
    });
  });

  describe('ALL_BILLING_KEYS constant', () => {
    it('contains all expected keys', () => {
      expect(ALL_BILLING_KEYS).toContain('billing.moyasar.platformSecretKey');
      expect(ALL_BILLING_KEYS).toContain('billing.moyasar.platformWebhookSecret');
      expect(ALL_BILLING_KEYS).toContain('billing.moyasar.publicKey');
      expect(ALL_BILLING_KEYS).toContain('billing.defaults.currency');
      expect(ALL_BILLING_KEYS).toContain('billing.defaults.taxPercent');
      expect(ALL_BILLING_KEYS).toContain('billing.defaults.trialDays');
    });
  });

  describe('getAllSettings', () => {
    it('returns all settings with values', async () => {
      mockSettings.get = jest.fn().mockResolvedValue('test-value');

      const result = await controller.getAllSettings();

      expect(result.settings).toHaveLength(ALL_BILLING_KEYS.length);
    });

    it('masks secret keys when they have values', async () => {
      mockSettings.get = jest.fn().mockResolvedValue('secret-value');

      const result = await controller.getAllSettings();

      const secretSetting = result.settings.find(s => s.key === 'billing.moyasar.platformSecretKey');
      expect(secretSetting?.value).toBe('***');
      expect(secretSetting?.isSecret).toBe(true);
    });

    it('shows actual value for secret keys when value is null', async () => {
      mockSettings.get = jest.fn().mockResolvedValue(null);

      const result = await controller.getAllSettings();

      const secretSetting = result.settings.find(s => s.key === 'billing.moyasar.platformSecretKey');
      expect(secretSetting?.value).toBe(null);
      expect(secretSetting?.isSecret).toBe(true);
    });

    it('shows actual value for non-secret keys', async () => {
      mockSettings.get = jest.fn().mockResolvedValue('USD');

      const result = await controller.getAllSettings();

      const currencySetting = result.settings.find(s => s.key === 'billing.defaults.currency');
      expect(currencySetting?.value).toBe('USD');
      expect(currencySetting?.isSecret).toBe(false);
    });
  });

  describe('updateSetting', () => {
    const req = { ip: '1.2.3.4', socket: { remoteAddress: '1.2.3.4' }, headers: { 'user-agent': 'jest' } } as unknown as Request;

    it('updates a valid billing key', async () => {
      mockSettings.get = jest.fn().mockResolvedValue('USD');
      mockSettings.set = jest.fn().mockResolvedValue(undefined);
      const user = { sub: 'user-1' } as never;

      await controller.updateSetting('billing.defaults.currency', { value: 'EUR' }, user, req);

      expect(mockSettings.set).toHaveBeenCalledWith('billing.defaults.currency', 'EUR', 'user-1', false);
    });

    it('updates a secret key with isSecret=true', async () => {
      mockSettings.get = jest.fn().mockResolvedValue('sk_live_old');
      mockSettings.set = jest.fn().mockResolvedValue(undefined);
      const user = { sub: 'user-1' } as never;

      await controller.updateSetting('billing.moyasar.platformSecretKey', { value: 'sk_live_xxx' }, user, req);

      expect(mockSettings.set).toHaveBeenCalledWith('billing.moyasar.platformSecretKey', 'sk_live_xxx', 'user-1', true);
    });

    it('throws BadRequestException for unknown key', async () => {
      const user = { sub: 'user-1' } as never;

      await expect(
        controller.updateSetting('unknown.key', { value: 'test' }, user, req),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException with correct message for unknown key', async () => {
      const user = { sub: 'user-1' } as never;

      await expect(
        controller.updateSetting('unknown.key', { value: 'test' }, user, req),
      ).rejects.toThrow('Unknown billing settings key: unknown.key');
    });

    it('returns updated true on success', async () => {
      mockSettings.get = jest.fn().mockResolvedValue('7');
      mockSettings.set = jest.fn().mockResolvedValue(undefined);
      const user = { sub: 'user-1' } as never;

      const result = await controller.updateSetting('billing.defaults.trialDays', { value: 14 }, user, req);

      expect(result).toEqual({ updated: true });
    });
  });

  describe('audit logging', () => {
    it('writes a PLATFORM_SETTING_UPDATED row when a non-secret setting changes', async () => {
      mockSettings.get = jest.fn().mockResolvedValue('15');
      mockSettings.set = jest.fn().mockResolvedValue(undefined);
      const user = { sub: 'user-1' } as never;
      const req = { ip: '1.2.3.4', socket: { remoteAddress: '1.2.3.4' }, headers: { 'user-agent': 'jest' } } as unknown as Request;

      await controller.updateSetting('billing.defaults.trialDays', { value: '30' }, user, req);

      expect(mockLogHandler.execute).toHaveBeenCalledWith(expect.objectContaining({
        superAdminUserId: 'user-1',
        settingKey: 'billing.defaults.trialDays',
        previousValue: '15',
        nextValue: '30',
        settingIsSecret: false,
        ipAddress: '1.2.3.4',
        userAgent: 'jest',
      }));
    });

    it('passes settingIsSecret=true for moyasar platformSecretKey', async () => {
      mockSettings.get = jest.fn().mockResolvedValue('sk_test_old');
      mockSettings.set = jest.fn().mockResolvedValue(undefined);
      const user = { sub: 'user-1' } as never;
      const req = { ip: '1.2.3.4', socket: { remoteAddress: '1.2.3.4' }, headers: { 'user-agent': 'jest' } } as unknown as Request;

      await controller.updateSetting('billing.moyasar.platformSecretKey', { value: 'sk_test_new' }, user, req);

      expect(mockLogHandler.execute).toHaveBeenCalledWith(expect.objectContaining({
        settingKey: 'billing.moyasar.platformSecretKey',
        settingIsSecret: true,
      }));
    });

    it('passes settingIsSecret=true for moyasar webhook secret', async () => {
      mockSettings.get = jest.fn().mockResolvedValue('whsec_old');
      mockSettings.set = jest.fn().mockResolvedValue(undefined);
      const user = { sub: 'user-1' } as never;
      const req = { ip: '1.2.3.4', socket: { remoteAddress: '1.2.3.4' }, headers: { 'user-agent': 'jest' } } as unknown as Request;

      await controller.updateSetting('billing.moyasar.platformWebhookSecret', { value: 'whsec_new' }, user, req);

      expect(mockLogHandler.execute).toHaveBeenCalledWith(expect.objectContaining({ settingIsSecret: true }));
    });

    it('skips audit log + set when previousValue === nextValue (no-op)', async () => {
      mockSettings.get = jest.fn().mockResolvedValue('SAR');
      mockSettings.set = jest.fn().mockResolvedValue(undefined);
      const user = { sub: 'user-1' } as never;
      const req = { ip: '1.2.3.4', socket: { remoteAddress: '1.2.3.4' }, headers: { 'user-agent': 'jest' } } as unknown as Request;

      await controller.updateSetting('billing.defaults.currency', { value: 'SAR' }, user, req);

      expect(mockSettings.set).not.toHaveBeenCalled();
      expect(mockLogHandler.execute).not.toHaveBeenCalled();
    });
  });
});
