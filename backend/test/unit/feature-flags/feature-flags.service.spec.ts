/**
 * FeatureFlagsService Unit Tests
 * Covers: findAll (cache hit/miss), getMap (cache hit/miss), toggle (success/not-found/invalidate), isEnabled
 */
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { FeatureFlagsService } from '../../../src/modules/feature-flags/feature-flags.service.js';
import { PrismaService } from '../../../src/database/prisma.service.js';
import { CacheService } from '../../../src/common/services/cache.service.js';
import { LicenseService } from '../../../src/modules/license/license.service.js';

const mockLicenseService = {
  isFeatureLicensed: jest.fn().mockResolvedValue(true),
  get: jest.fn().mockResolvedValue({}),
  getFeaturesWithStatus: jest.fn().mockResolvedValue([]),
};

const mockPrisma = {
  featureFlag: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
};

const mockCache = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
};

const flagA = {
  key: 'dark_mode',
  enabled: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};
const flagB = {
  key: 'new_dashboard',
  enabled: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

async function createModule() {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      FeatureFlagsService,
      { provide: PrismaService, useValue: mockPrisma },
      { provide: CacheService, useValue: mockCache },
      { provide: LicenseService, useValue: mockLicenseService },
    ],
  }).compile();
  return module.get<FeatureFlagsService>(FeatureFlagsService);
}

describe('FeatureFlagsService', () => {
  let service: FeatureFlagsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockLicenseService.isFeatureLicensed.mockResolvedValue(true);
    service = await createModule();
  });

  // ─── findAll ─────────────────────────────────────────────────

  describe('findAll', () => {
    it('returns cached flags on cache hit — does not query DB', async () => {
      mockCache.get.mockResolvedValue([flagA, flagB]);

      const result = await service.findAll();

      expect(result).toEqual([flagA, flagB]);
      expect(mockCache.get).toHaveBeenCalledWith('feature_flags:all');
      expect(mockPrisma.featureFlag.findMany).not.toHaveBeenCalled();
      expect(mockCache.set).not.toHaveBeenCalled();
    });

    it('fetches from DB, stores in cache, and returns flags on cache miss', async () => {
      mockCache.get.mockResolvedValue(null);
      mockPrisma.featureFlag.findMany.mockResolvedValue([flagA, flagB]);

      const result = await service.findAll();

      expect(result).toEqual([flagA, flagB]);
      expect(mockPrisma.featureFlag.findMany).toHaveBeenCalledWith({
        orderBy: { key: 'asc' },
      });
      expect(mockCache.set).toHaveBeenCalledWith(
        'feature_flags:all',
        [flagA, flagB],
        300,
      );
    });

    it('returns empty array when no flags exist', async () => {
      mockCache.get.mockResolvedValue(null);
      mockPrisma.featureFlag.findMany.mockResolvedValue([]);

      const result = await service.findAll();

      expect(result).toEqual([]);
      expect(mockCache.set).toHaveBeenCalledWith('feature_flags:all', [], 300);
    });
  });

  // ─── getMap ──────────────────────────────────────────────────

  describe('getMap', () => {
    it('returns cached map on cache hit — does not query DB', async () => {
      const cachedMap = { dark_mode: true, new_dashboard: false };
      mockCache.get.mockResolvedValue(cachedMap);

      const result = await service.getMap();

      expect(result).toEqual(cachedMap);
      expect(mockCache.get).toHaveBeenCalledWith('feature_flags:map');
      expect(mockPrisma.featureFlag.findMany).not.toHaveBeenCalled();
    });

    it('builds key→boolean map via licenseService.getFeaturesWithStatus, caches it, returns map on cache miss', async () => {
      mockCache.get.mockResolvedValue(null);
      mockLicenseService.getFeaturesWithStatus.mockResolvedValue([
        { key: 'dark_mode', enabled: true },
        { key: 'new_dashboard', enabled: false },
      ]);

      const result = await service.getMap();

      expect(result).toEqual({ dark_mode: true, new_dashboard: false });
      expect(mockLicenseService.getFeaturesWithStatus).toHaveBeenCalled();
      expect(mockPrisma.featureFlag.findMany).not.toHaveBeenCalled();
      expect(mockCache.set).toHaveBeenCalledWith(
        'feature_flags:map',
        { dark_mode: true, new_dashboard: false },
        300,
      );
    });

    it('returns empty object when no flags exist', async () => {
      mockCache.get.mockResolvedValue(null);
      mockLicenseService.getFeaturesWithStatus.mockResolvedValue([]);

      const result = await service.getMap();

      expect(result).toEqual({});
    });
  });

  // ─── toggle ──────────────────────────────────────────────────

  describe('toggle', () => {
    it('updates flag, invalidates both cache keys, and returns updated flag', async () => {
      const updated = { ...flagA, enabled: false };
      mockPrisma.featureFlag.findUnique.mockResolvedValue(flagA);
      mockPrisma.featureFlag.update.mockResolvedValue(updated);
      mockCache.del.mockResolvedValue(undefined);

      const result = await service.toggle('dark_mode', false);

      expect(result).toEqual(updated);
      expect(mockPrisma.featureFlag.findUnique).toHaveBeenCalledWith({
        where: { key: 'dark_mode' },
      });
      expect(mockPrisma.featureFlag.update).toHaveBeenCalledWith({
        where: { key: 'dark_mode' },
        data: { enabled: false },
      });
      expect(mockCache.del).toHaveBeenCalledWith('feature_flags:all');
      expect(mockCache.del).toHaveBeenCalledWith('feature_flags:map');
      expect(mockCache.del).toHaveBeenCalledTimes(2);
    });

    it('throws NotFoundException with correct shape when flag does not exist', async () => {
      mockPrisma.featureFlag.findUnique.mockResolvedValue(null);

      await expect(service.toggle('unknown_flag', true)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.toggle('unknown_flag', true)).rejects.toMatchObject({
        response: { statusCode: 404, error: 'Not Found' },
      });
    });

    it('does NOT call update or invalidate when flag not found', async () => {
      mockPrisma.featureFlag.findUnique.mockResolvedValue(null);

      await expect(service.toggle('missing', true)).rejects.toThrow();

      expect(mockPrisma.featureFlag.update).not.toHaveBeenCalled();
      expect(mockCache.del).not.toHaveBeenCalled();
    });

    it('enables a disabled flag correctly', async () => {
      const enabled = { ...flagB, enabled: true };
      mockPrisma.featureFlag.findUnique.mockResolvedValue(flagB);
      mockPrisma.featureFlag.update.mockResolvedValue(enabled);

      const result = await service.toggle('new_dashboard', true);

      expect(result.enabled).toBe(true);
      expect(mockPrisma.featureFlag.update).toHaveBeenCalledWith({
        where: { key: 'new_dashboard' },
        data: { enabled: true },
      });
    });

    it('throws ForbiddenException when enabling a flag that is not licensed', async () => {
      mockPrisma.featureFlag.findUnique.mockResolvedValue(flagB);
      mockLicenseService.isFeatureLicensed.mockResolvedValue(false);

      await expect(service.toggle('new_dashboard', true)).rejects.toThrow(
        ForbiddenException,
      );
      expect(mockPrisma.featureFlag.update).not.toHaveBeenCalled();
      expect(mockCache.del).not.toHaveBeenCalled();
    });

    it('allows disabling a flag even when not licensed — no ForbiddenException', async () => {
      const disabled = { ...flagA, enabled: false };
      mockPrisma.featureFlag.findUnique.mockResolvedValue(flagA);
      mockPrisma.featureFlag.update.mockResolvedValue(disabled);

      const result = await service.toggle('dark_mode', false);

      expect(result.enabled).toBe(false);
      expect(mockLicenseService.isFeatureLicensed).not.toHaveBeenCalled();
    });

    it('checks license only when enabling, not when disabling', async () => {
      mockPrisma.featureFlag.findUnique.mockResolvedValue(flagA);
      mockPrisma.featureFlag.update.mockResolvedValue({
        ...flagA,
        enabled: false,
      });

      await service.toggle('dark_mode', false);

      expect(mockLicenseService.isFeatureLicensed).not.toHaveBeenCalled();
    });
  });

  // ─── isEnabled ───────────────────────────────────────────────

  describe('isEnabled', () => {
    it('returns true when flag exists and is enabled', async () => {
      mockCache.get.mockResolvedValue({ dark_mode: true, beta: false });

      expect(await service.isEnabled('dark_mode')).toBe(true);
    });

    it('returns false when flag exists and is disabled', async () => {
      mockCache.get.mockResolvedValue({ dark_mode: true, beta: false });

      expect(await service.isEnabled('beta')).toBe(false);
    });

    it('returns false when flag key is not in map', async () => {
      mockCache.get.mockResolvedValue({ dark_mode: true });

      expect(await service.isEnabled('nonexistent')).toBe(false);
    });

    it('returns false when map is empty', async () => {
      mockCache.get.mockResolvedValue(null);
      mockLicenseService.getFeaturesWithStatus.mockResolvedValue([]);

      expect(await service.isEnabled('any_key')).toBe(false);
    });

    it('returns false when flag is enabled but not licensed', async () => {
      mockCache.get.mockResolvedValue({ coupons: true });
      mockLicenseService.isFeatureLicensed.mockResolvedValue(false);

      expect(await service.isEnabled('coupons')).toBe(false);
    });

    it('returns true only when both flag is enabled AND licensed', async () => {
      mockCache.get.mockResolvedValue({ coupons: true });
      mockLicenseService.isFeatureLicensed.mockResolvedValue(true);

      expect(await service.isEnabled('coupons')).toBe(true);
    });
  });
});
