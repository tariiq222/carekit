/**
 * License ↔ FeatureFlags Integration Tests
 * Covers: race conditions, cache staleness, cascade effects, bulk atomicity
 *
 * These tests verify that the license + feature-flag system behaves correctly
 * under complex real-world scenarios where both systems interact.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { LicenseService } from '../../../src/modules/license/license.service.js';
import { FeatureFlagsService } from '../../../src/modules/feature-flags/feature-flags.service.js';
import { PrismaService } from '../../../src/database/prisma.service.js';
import { CacheService } from '../../../src/common/services/cache.service.js';

const baseLicense = {
  id: 'lic-1',
  hasCoupons: true,
  hasGiftCards: false,
  hasIntakeForms: true,
  hasChatbot: false,
  hasRatings: true,
  hasMultiBranch: true,
  hasReports: false,
  hasRecurring: true,
  hasWalkIn: true,
  hasWaitlist: false,
  hasZoom: false,
  hasZatca: true,
  hasDepartments: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockPrisma = {
  licenseConfig: {
    findFirstOrThrow: jest.fn(),
    update: jest.fn(),
  },
  featureFlag: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
};

const cacheStore = new Map<string, unknown>();
const mockCache = {
  get: jest.fn((key: string) => Promise.resolve(cacheStore.get(key) ?? null)),
  set: jest.fn((key: string, value: unknown) => {
    cacheStore.set(key, value);
    return Promise.resolve();
  }),
  del: jest.fn((key: string) => {
    cacheStore.delete(key);
    return Promise.resolve();
  }),
};

async function createModule() {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      LicenseService,
      FeatureFlagsService,
      { provide: PrismaService, useValue: mockPrisma },
      { provide: CacheService, useValue: mockCache },
    ],
  }).compile();

  return {
    licenseService: module.get<LicenseService>(LicenseService),
    featureFlagsService: module.get<FeatureFlagsService>(FeatureFlagsService),
  };
}

describe('License ↔ FeatureFlags Integration', () => {
  let licenseService: LicenseService;
  let featureFlagsService: FeatureFlagsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    cacheStore.clear();
    const services = await createModule();
    licenseService = services.licenseService;
    featureFlagsService = services.featureFlagsService;
  });

  // ─── Race Condition: disable license while flag toggle in flight ──

  describe('race condition — license disabled mid-toggle', () => {
    it('blocks enabling a flag when license is revoked between check moments', async () => {
      const flag = {
        key: 'coupons',
        enabled: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockPrisma.featureFlag.findUnique.mockResolvedValue(flag);

      // License starts enabled, then gets revoked
      mockPrisma.licenseConfig.findFirstOrThrow.mockResolvedValue({
        ...baseLicense,
        hasCoupons: false,
      });

      await expect(featureFlagsService.toggle('coupons', true)).rejects.toThrow(
        ForbiddenException,
      );

      expect(mockPrisma.featureFlag.update).not.toHaveBeenCalled();
    });

    it('isEnabled returns false immediately after license revocation (cache cleared)', async () => {
      // Step 1: license is active, flag is enabled → isEnabled = true
      mockPrisma.licenseConfig.findFirstOrThrow.mockResolvedValue(baseLicense);
      mockPrisma.featureFlag.findMany.mockResolvedValue([
        { key: 'coupons', enabled: true },
      ]);

      expect(await featureFlagsService.isEnabled('coupons')).toBe(true);

      // Step 2: license gets revoked → update clears cache
      const revokedLicense = { ...baseLicense, hasCoupons: false };
      mockPrisma.licenseConfig.findFirstOrThrow.mockResolvedValue(baseLicense);
      mockPrisma.licenseConfig.update.mockResolvedValue(revokedLicense);
      await licenseService.update({ hasCoupons: false });

      // Step 3: after cache invalidation, isEnabled must re-fetch and return false
      mockPrisma.licenseConfig.findFirstOrThrow.mockResolvedValue(
        revokedLicense,
      );
      mockPrisma.featureFlag.findMany.mockResolvedValue([
        { key: 'coupons', enabled: true },
      ]);

      expect(await featureFlagsService.isEnabled('coupons')).toBe(false);
    });
  });

  // ─── Cache Staleness ─────────────────────────────────────────

  describe('cache staleness — stale flag map after license change', () => {
    it('flag map cache does not affect license check — isEnabled always re-validates license', async () => {
      // Pre-warm flag map cache
      mockPrisma.featureFlag.findMany.mockResolvedValue([
        { key: 'chatbot', enabled: true },
      ]);
      cacheStore.set('feature_flags:map', { chatbot: true });

      // License says chatbot is NOT licensed
      mockPrisma.licenseConfig.findFirstOrThrow.mockResolvedValue({
        ...baseLicense,
        hasChatbot: false,
      });

      // Even though flag map cache says enabled=true, license check should block
      expect(await featureFlagsService.isEnabled('chatbot')).toBe(false);
    });

    it('license cache invalidation forces fresh DB read on next get', async () => {
      // Warm license cache
      mockPrisma.licenseConfig.findFirstOrThrow.mockResolvedValue(baseLicense);
      await licenseService.get();
      expect(cacheStore.has('cache:license')).toBe(true);

      // Update license → should clear cache
      mockPrisma.licenseConfig.update.mockResolvedValue({
        ...baseLicense,
        hasReports: true,
      });
      await licenseService.update({ hasReports: true });
      expect(cacheStore.has('cache:license')).toBe(false);

      // Next get() must hit DB, not stale cache
      const freshLicense = { ...baseLicense, hasReports: true };
      mockPrisma.licenseConfig.findFirstOrThrow.mockResolvedValue(freshLicense);
      const result = await licenseService.get();

      expect(result.hasReports).toBe(true);
      expect(mockPrisma.licenseConfig.findFirstOrThrow).toHaveBeenCalledTimes(
        3,
      );
    });
  });

  // ─── Cascade Effect: cron jobs and unlicensed features ────────

  describe('cascade — getFeaturesWithStatus reflects license correctly', () => {
    it('enabled becomes false for ALL unlicensed features regardless of flag state', async () => {
      mockPrisma.licenseConfig.findFirstOrThrow.mockResolvedValue({
        ...baseLicense,
        hasCoupons: false,
        hasRatings: false,
        hasRecurring: false,
      });
      mockPrisma.featureFlag.findMany.mockResolvedValue([
        { key: 'coupons', enabled: true, nameAr: 'كوبونات', nameEn: 'Coupons' },
        { key: 'ratings', enabled: true, nameAr: 'تقييمات', nameEn: 'Ratings' },
        {
          key: 'recurring',
          enabled: true,
          nameAr: 'حجز متكرر',
          nameEn: 'Recurring',
        },
        {
          key: 'walk_in',
          enabled: true,
          nameAr: 'حضور بدون موعد',
          nameEn: 'Walk-in',
        },
      ]);

      const result = await licenseService.getFeaturesWithStatus();

      // Unlicensed → enabled must be false even though flag.enabled=true
      expect(result.find((f) => f.key === 'coupons')).toMatchObject({
        licensed: false,
        enabled: false,
      });
      expect(result.find((f) => f.key === 'ratings')).toMatchObject({
        licensed: false,
        enabled: false,
      });
      expect(result.find((f) => f.key === 'recurring')).toMatchObject({
        licensed: false,
        enabled: false,
      });

      // Licensed + enabled → should remain true
      expect(result.find((f) => f.key === 'walk_in')).toMatchObject({
        licensed: true,
        enabled: true,
      });
    });

    it('isEnabled blocks access for features whose license was just revoked', async () => {
      // Simulate: recurring was licensed, cron checks isEnabled
      mockPrisma.licenseConfig.findFirstOrThrow.mockResolvedValue(baseLicense);
      mockPrisma.featureFlag.findMany.mockResolvedValue([
        { key: 'recurring', enabled: true },
      ]);

      expect(await featureFlagsService.isEnabled('recurring')).toBe(true);

      // Now license gets revoked
      const revokedLicense = { ...baseLicense, hasRecurring: false };
      mockPrisma.licenseConfig.update.mockResolvedValue(revokedLicense);
      mockPrisma.licenseConfig.findFirstOrThrow.mockResolvedValue(baseLicense);
      await licenseService.update({ hasRecurring: false });

      // Cron job checks again — must get false
      mockPrisma.licenseConfig.findFirstOrThrow.mockResolvedValue(
        revokedLicense,
      );
      expect(await featureFlagsService.isEnabled('recurring')).toBe(false);
    });

    it('re-enabling license restores feature access', async () => {
      // Start with revoked
      const revokedLicense = { ...baseLicense, hasChatbot: false };
      mockPrisma.licenseConfig.findFirstOrThrow.mockResolvedValue(
        revokedLicense,
      );
      mockPrisma.featureFlag.findMany.mockResolvedValue([
        { key: 'chatbot', enabled: true },
      ]);

      expect(await featureFlagsService.isEnabled('chatbot')).toBe(false);

      // Re-enable license
      const restoredLicense = { ...baseLicense, hasChatbot: true };
      mockPrisma.licenseConfig.update.mockResolvedValue(restoredLicense);
      mockPrisma.licenseConfig.findFirstOrThrow.mockResolvedValue(
        revokedLicense,
      );
      await licenseService.update({ hasChatbot: true });

      // Now isEnabled should return true
      mockPrisma.licenseConfig.findFirstOrThrow.mockResolvedValue(
        restoredLicense,
      );
      expect(await featureFlagsService.isEnabled('chatbot')).toBe(true);
    });
  });

  // ─── Bulk Toggle Atomicity ────────────────────────────────────

  describe('bulk toggle — multi-field license update', () => {
    it('updates multiple license fields in a single call without corruption', async () => {
      const dto = {
        hasCoupons: false,
        hasGiftCards: true,
        hasZoom: true,
        hasReports: true,
      };
      const updated = { ...baseLicense, ...dto };

      mockPrisma.licenseConfig.findFirstOrThrow.mockResolvedValue(baseLicense);
      mockPrisma.licenseConfig.update.mockResolvedValue(updated);

      const result = await licenseService.update(dto);

      // Changed fields
      expect(result.hasCoupons).toBe(false);
      expect(result.hasGiftCards).toBe(true);
      expect(result.hasZoom).toBe(true);
      expect(result.hasReports).toBe(true);

      // Untouched fields remain intact
      expect(result.hasRatings).toBe(baseLicense.hasRatings);
      expect(result.hasRecurring).toBe(baseLicense.hasRecurring);
      expect(result.hasZatca).toBe(baseLicense.hasZatca);
      expect(result.hasChatbot).toBe(baseLicense.hasChatbot);
      expect(result.hasDepartments).toBe(baseLicense.hasDepartments);
    });

    it('invalidates cache exactly once per update regardless of field count', async () => {
      mockPrisma.licenseConfig.findFirstOrThrow.mockResolvedValue(baseLicense);
      mockPrisma.licenseConfig.update.mockResolvedValue(baseLicense);

      await licenseService.update({
        hasCoupons: false,
        hasGiftCards: true,
        hasZoom: true,
        hasReports: true,
        hasWaitlist: true,
      });

      // del called exactly 3 times: LICENSE + LICENSE_FEATURES + FEATURE_FLAGS_MAP
      expect(mockCache.del).toHaveBeenCalledWith('cache:license');
      expect(mockCache.del).toHaveBeenCalledWith('cache:license:features');
      expect(mockCache.del).toHaveBeenCalledWith('feature_flags:map');
      expect(mockCache.del).toHaveBeenCalledTimes(3);
    });

    it('getFeaturesWithStatus correctly reflects bulk update', async () => {
      const updated = { ...baseLicense, hasCoupons: false, hasGiftCards: true };
      mockPrisma.licenseConfig.findFirstOrThrow.mockResolvedValue(updated);
      mockPrisma.featureFlag.findMany.mockResolvedValue([
        { key: 'coupons', enabled: true, nameAr: 'كوبونات', nameEn: 'Coupons' },
        {
          key: 'gift_cards',
          enabled: true,
          nameAr: 'بطاقات هدايا',
          nameEn: 'Gift Cards',
        },
      ]);

      const features = await licenseService.getFeaturesWithStatus();

      // coupons: license revoked → enabled=false despite flag=true
      expect(features.find((f) => f.key === 'coupons')).toMatchObject({
        licensed: false,
        enabled: false,
      });
      // gift_cards: license granted → enabled=true because flag=true
      expect(features.find((f) => f.key === 'gift_cards')).toMatchObject({
        licensed: true,
        enabled: true,
      });
    });
  });

  // ─── Edge Cases ───────────────────────────────────────────────

  describe('edge cases', () => {
    it('empty update dto does not corrupt license', async () => {
      mockPrisma.licenseConfig.findFirstOrThrow.mockResolvedValue(baseLicense);
      mockPrisma.licenseConfig.update.mockResolvedValue(baseLicense);

      const result = await licenseService.update({});

      expect(result).toEqual(baseLicense);
      expect(mockPrisma.licenseConfig.update).toHaveBeenCalledWith({
        where: { id: baseLicense.id },
        data: {},
      });
    });

    it('toggling all features off then on preserves independence', async () => {
      // All off
      const allOff = {
        ...baseLicense,
        hasCoupons: false,
        hasGiftCards: false,
        hasIntakeForms: false,
        hasChatbot: false,
        hasRatings: false,
        hasMultiBranch: false,
        hasReports: false,
        hasRecurring: false,
        hasWalkIn: false,
        hasWaitlist: false,
        hasZoom: false,
        hasZatca: false,
        hasDepartments: false,
      };
      mockPrisma.licenseConfig.findFirstOrThrow.mockResolvedValue(baseLicense);
      mockPrisma.licenseConfig.update.mockResolvedValue(allOff);

      const offResult = await licenseService.update({
        hasCoupons: false,
        hasGiftCards: false,
        hasIntakeForms: false,
        hasChatbot: false,
        hasRatings: false,
        hasMultiBranch: false,
        hasReports: false,
        hasRecurring: false,
        hasWalkIn: false,
        hasWaitlist: false,
        hasZoom: false,
        hasZatca: false,
        hasDepartments: false,
      });

      expect(offResult.hasCoupons).toBe(false);
      expect(offResult.hasZatca).toBe(false);

      // Re-enable only one
      const oneOn = { ...allOff, hasCoupons: true };
      mockPrisma.licenseConfig.findFirstOrThrow.mockResolvedValue(allOff);
      mockPrisma.licenseConfig.update.mockResolvedValue(oneOn);

      const onResult = await licenseService.update({ hasCoupons: true });

      expect(onResult.hasCoupons).toBe(true);
      expect(onResult.hasGiftCards).toBe(false);
      expect(onResult.hasZatca).toBe(false);
    });
  });
});
