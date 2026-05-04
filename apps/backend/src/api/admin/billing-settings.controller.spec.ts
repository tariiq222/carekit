import { BadRequestException } from '@nestjs/common';
import { BillingSettingsController } from './billing-settings.controller';
import { PlatformSettingsService } from '../../modules/platform/settings/platform-settings.service';

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

  beforeEach(() => {
    mockSettings = {
      get: jest.fn(),
      set: jest.fn(),
    };
    controller = new BillingSettingsController(mockSettings as PlatformSettingsService);
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
    it('updates a valid billing key', async () => {
      mockSettings.set = jest.fn().mockResolvedValue(undefined);
      const user = { sub: 'user-1' } as never;

      await controller.updateSetting('billing.defaults.currency', { value: 'EUR' }, user);

      expect(mockSettings.set).toHaveBeenCalledWith('billing.defaults.currency', 'EUR', 'user-1', false);
    });

    it('updates a secret key with isSecret=true', async () => {
      mockSettings.set = jest.fn().mockResolvedValue(undefined);
      const user = { sub: 'user-1' } as never;

      await controller.updateSetting('billing.moyasar.platformSecretKey', { value: 'sk_live_xxx' }, user);

      expect(mockSettings.set).toHaveBeenCalledWith('billing.moyasar.platformSecretKey', 'sk_live_xxx', 'user-1', true);
    });

    it('throws BadRequestException for unknown key', async () => {
      const user = { sub: 'user-1' } as never;

      await expect(
        controller.updateSetting('unknown.key', { value: 'test' }, user),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException with correct message for unknown key', async () => {
      const user = { sub: 'user-1' } as never;

      await expect(
        controller.updateSetting('unknown.key', { value: 'test' }, user),
      ).rejects.toThrow('Unknown billing settings key: unknown.key');
    });

    it('returns updated true on success', async () => {
      mockSettings.set = jest.fn().mockResolvedValue(undefined);
      const user = { sub: 'user-1' } as never;

      const result = await controller.updateSetting('billing.defaults.trialDays', { value: 14 }, user);

      expect(result).toEqual({ updated: true });
    });
  });
});
