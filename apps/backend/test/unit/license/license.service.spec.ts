/**
 * LicenseService Unit Tests
 * Covers: get (cache hit/miss), update (invalidates cache), isFeatureLicensed, getFeaturesWithStatus
 */
import { Test, TestingModule } from '@nestjs/testing';
import { LicenseService } from '../../../src/modules/license/license.service.js';
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
  hasGroups: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const flagCoupons = {
  key: 'coupons',
  enabled: true,
  nameAr: 'الكوبونات',
  nameEn: 'Coupons',
  descriptionAr: '',
  descriptionEn: '',
  createdAt: new Date(),
  updatedAt: new Date(),
};
const flagGifts = {
  key: 'gift_cards',
  enabled: true,
  nameAr: 'بطاقات الهدايا',
  nameEn: 'Gift Cards',
  descriptionAr: '',
  descriptionEn: '',
  createdAt: new Date(),
  updatedAt: new Date(),
};
const flagUnknown = {
  key: 'unknown_feature',
  enabled: true,
  nameAr: 'غير معروف',
  nameEn: 'Unknown',
  descriptionAr: '',
  descriptionEn: '',
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
  },
};

const mockCache = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
};

async function createModule() {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      LicenseService,
      { provide: PrismaService, useValue: mockPrisma },
      { provide: CacheService, useValue: mockCache },
    ],
  }).compile();
  return module.get<LicenseService>(LicenseService);
}

describe('LicenseService', () => {
  let service: LicenseService;

  beforeEach(async () => {
    jest.clearAllMocks();
    service = await createModule();
  });

  // ─── get ─────────────────────────────────────────────────────

  describe('get', () => {
    it('returns cached license on cache hit — does not query DB', async () => {
      mockCache.get.mockResolvedValue(baseLicense);

      const result = await service.get();

      expect(result).toEqual(baseLicense);
      expect(mockCache.get).toHaveBeenCalledWith('cache:license');
      expect(mockPrisma.licenseConfig.findFirstOrThrow).not.toHaveBeenCalled();
    });

    it('fetches from DB, stores in cache, and returns license on cache miss', async () => {
      mockCache.get.mockResolvedValue(null);
      mockPrisma.licenseConfig.findFirstOrThrow.mockResolvedValue(baseLicense);

      const result = await service.get();

      expect(result).toEqual(baseLicense);
      expect(mockPrisma.licenseConfig.findFirstOrThrow).toHaveBeenCalled();
      expect(mockCache.set).toHaveBeenCalledWith(
        'cache:license',
        baseLicense,
        3600,
      );
    });

    it('throws when no license record exists', async () => {
      mockCache.get.mockResolvedValue(null);
      mockPrisma.licenseConfig.findFirstOrThrow.mockRejectedValue(
        new Error('Not found'),
      );

      await expect(service.get()).rejects.toThrow('Not found');
    });
  });

  // ─── update ──────────────────────────────────────────────────

  describe('update', () => {
    it('updates license and invalidates both cache keys', async () => {
      const updated = { ...baseLicense, hasCoupons: false };
      mockPrisma.licenseConfig.findFirstOrThrow.mockResolvedValue(baseLicense);
      mockPrisma.licenseConfig.update.mockResolvedValue(updated);

      const result = await service.update({ hasCoupons: false });

      expect(result).toEqual(updated);
      expect(mockPrisma.licenseConfig.update).toHaveBeenCalledWith({
        where: { id: baseLicense.id },
        data: { hasCoupons: false },
      });
      expect(mockCache.del).toHaveBeenCalledWith('cache:license');
      expect(mockCache.del).toHaveBeenCalledWith('cache:license:features');
    });

    it('handles partial update — only changed fields are sent', async () => {
      mockPrisma.licenseConfig.findFirstOrThrow.mockResolvedValue(baseLicense);
      mockPrisma.licenseConfig.update.mockResolvedValue({
        ...baseLicense,
        hasZoom: true,
      });

      await service.update({ hasZoom: true });

      expect(mockPrisma.licenseConfig.update).toHaveBeenCalledWith({
        where: { id: baseLicense.id },
        data: { hasZoom: true },
      });
    });

    it('invalidates cache even when update has no actual value change', async () => {
      mockPrisma.licenseConfig.findFirstOrThrow.mockResolvedValue(baseLicense);
      mockPrisma.licenseConfig.update.mockResolvedValue(baseLicense);

      await service.update({ hasCoupons: true });

      expect(mockCache.del).toHaveBeenCalledTimes(3);
    });
  });

  // ─── isFeatureLicensed ───────────────────────────────────────

  describe('isFeatureLicensed', () => {
    it('returns true when feature is licensed', async () => {
      mockCache.get.mockResolvedValue(baseLicense);

      expect(await service.isFeatureLicensed('coupons')).toBe(true);
    });

    it('returns false when feature is not licensed', async () => {
      mockCache.get.mockResolvedValue(baseLicense);

      expect(await service.isFeatureLicensed('gift_cards')).toBe(false);
    });

    it('returns true for unknown flag keys (not in FLAG_TO_LICENSE map)', async () => {
      mockCache.get.mockResolvedValue(baseLicense);

      expect(await service.isFeatureLicensed('unknown_feature')).toBe(true);
    });

    it('checks each license field correctly', async () => {
      mockCache.get.mockResolvedValue(baseLicense);

      expect(await service.isFeatureLicensed('ratings')).toBe(true);
      expect(await service.isFeatureLicensed('chatbot')).toBe(false);
      expect(await service.isFeatureLicensed('multi_branch')).toBe(true);
      expect(await service.isFeatureLicensed('reports')).toBe(false);
      expect(await service.isFeatureLicensed('recurring')).toBe(true);
      expect(await service.isFeatureLicensed('waitlist')).toBe(false);
      expect(await service.isFeatureLicensed('zatca')).toBe(true);
      expect(await service.isFeatureLicensed('departments')).toBe(false);
    });

    it('returns false for groups when hasGroups=false (default)', async () => {
      mockCache.get.mockResolvedValue(baseLicense);

      expect(await service.isFeatureLicensed('groups')).toBe(false);
    });

    it('returns true for groups when hasGroups=true', async () => {
      mockCache.get.mockResolvedValue({ ...baseLicense, hasGroups: true });

      expect(await service.isFeatureLicensed('groups')).toBe(true);
    });
  });

  // ─── getFeaturesWithStatus ───────────────────────────────────

  describe('getFeaturesWithStatus', () => {
    it('returns features with correct licensed and enabled status', async () => {
      mockCache.get.mockResolvedValue(null);
      mockPrisma.licenseConfig.findFirstOrThrow.mockResolvedValue(baseLicense);
      mockPrisma.featureFlag.findMany.mockResolvedValue([
        flagCoupons,
        flagGifts,
      ]);

      const result = await service.getFeaturesWithStatus();

      expect(result).toEqual([
        {
          key: 'coupons',
          licensed: true,
          enabled: true,
          nameAr: 'الكوبونات',
          nameEn: 'Coupons',
        },
        {
          key: 'gift_cards',
          licensed: false,
          enabled: false,
          nameAr: 'بطاقات الهدايا',
          nameEn: 'Gift Cards',
        },
      ]);
    });

    it('enabled is false when licensed=true but flag.enabled=false', async () => {
      const disabledFlag = { ...flagCoupons, enabled: false };
      mockCache.get.mockResolvedValue(null);
      mockPrisma.licenseConfig.findFirstOrThrow.mockResolvedValue(baseLicense);
      mockPrisma.featureFlag.findMany.mockResolvedValue([disabledFlag]);

      const result = await service.getFeaturesWithStatus();

      expect(result[0].licensed).toBe(true);
      expect(result[0].enabled).toBe(false);
    });

    it('enabled is false when licensed=false even if flag.enabled=true', async () => {
      mockCache.get.mockResolvedValue(null);
      mockPrisma.licenseConfig.findFirstOrThrow.mockResolvedValue(baseLicense);
      mockPrisma.featureFlag.findMany.mockResolvedValue([flagGifts]);

      const result = await service.getFeaturesWithStatus();

      expect(result[0].licensed).toBe(false);
      expect(result[0].enabled).toBe(false);
    });

    it('unknown keys default to licensed=true', async () => {
      mockCache.get.mockResolvedValue(null);
      mockPrisma.licenseConfig.findFirstOrThrow.mockResolvedValue(baseLicense);
      mockPrisma.featureFlag.findMany.mockResolvedValue([flagUnknown]);

      const result = await service.getFeaturesWithStatus();

      expect(result[0].licensed).toBe(true);
      expect(result[0].enabled).toBe(true);
    });

    it('returns empty array when no feature flags exist', async () => {
      mockCache.get.mockResolvedValue(null);
      mockPrisma.licenseConfig.findFirstOrThrow.mockResolvedValue(baseLicense);
      mockPrisma.featureFlag.findMany.mockResolvedValue([]);

      const result = await service.getFeaturesWithStatus();

      expect(result).toEqual([]);
    });

    it('groups shows licensed=false and enabled=false when not in license', async () => {
      const flagGroups = {
        key: 'groups',
        enabled: true,
        nameAr: 'المجموعات',
        nameEn: 'Groups',
        descriptionAr: '',
        descriptionEn: '',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockCache.get.mockResolvedValue(null);
      mockPrisma.licenseConfig.findFirstOrThrow.mockResolvedValue(baseLicense); // hasGroups=false
      mockPrisma.featureFlag.findMany.mockResolvedValue([flagGroups]);

      const result = await service.getFeaturesWithStatus();

      expect(result[0]).toMatchObject({
        key: 'groups',
        licensed: false,
        enabled: false,
      });
    });

    it('groups shows licensed=true and enabled=true when in license and flag enabled', async () => {
      const licensedLicense = { ...baseLicense, hasGroups: true };
      const flagGroups = {
        key: 'groups',
        enabled: true,
        nameAr: 'المجموعات',
        nameEn: 'Groups',
        descriptionAr: '',
        descriptionEn: '',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockCache.get.mockResolvedValue(null);
      mockPrisma.licenseConfig.findFirstOrThrow.mockResolvedValue(
        licensedLicense,
      );
      mockPrisma.featureFlag.findMany.mockResolvedValue([flagGroups]);

      const result = await service.getFeaturesWithStatus();

      expect(result[0]).toMatchObject({
        key: 'groups',
        licensed: true,
        enabled: true,
      });
    });
  });

  // ─── toggle + license interaction (via FeatureFlagsService) ──

  describe('update → toggle interaction (system-level)', () => {
    it('disabling license does not corrupt other license fields', async () => {
      mockPrisma.licenseConfig.findFirstOrThrow.mockResolvedValue(baseLicense);
      const updated = { ...baseLicense, hasCoupons: false };
      mockPrisma.licenseConfig.update.mockResolvedValue(updated);

      const result = await service.update({ hasCoupons: false });

      expect(result.hasGiftCards).toBe(baseLicense.hasGiftCards);
      expect(result.hasRatings).toBe(baseLicense.hasRatings);
      expect(result.hasMultiBranch).toBe(baseLicense.hasMultiBranch);
      expect(result.hasZatca).toBe(baseLicense.hasZatca);
    });

    it('enabling license does not affect other license fields', async () => {
      mockPrisma.licenseConfig.findFirstOrThrow.mockResolvedValue(baseLicense);
      const updated = { ...baseLicense, hasGiftCards: true };
      mockPrisma.licenseConfig.update.mockResolvedValue(updated);

      const result = await service.update({ hasGiftCards: true });

      expect(result.hasCoupons).toBe(baseLicense.hasCoupons);
      expect(result.hasRatings).toBe(baseLicense.hasRatings);
      expect(result.hasZatca).toBe(baseLicense.hasZatca);
    });

    it('multiple fields can be toggled in a single update', async () => {
      const dto = { hasCoupons: false, hasGiftCards: true, hasZoom: true };
      const updated = { ...baseLicense, ...dto };
      mockPrisma.licenseConfig.findFirstOrThrow.mockResolvedValue(baseLicense);
      mockPrisma.licenseConfig.update.mockResolvedValue(updated);

      const result = await service.update(dto);

      expect(result.hasCoupons).toBe(false);
      expect(result.hasGiftCards).toBe(true);
      expect(result.hasZoom).toBe(true);
      expect(result.hasRatings).toBe(baseLicense.hasRatings);
    });
  });
});
