/**
 * CareKit — WhitelabelService Unit Tests
 *
 * Tests the new structured WhitelabelService:
 *   - get() returns the WhiteLabelConfig row (cached)
 *   - getPublicBranding() returns public-facing subset
 *   - update() respects clinicCanEdit lock
 *   - adminUpdate() bypasses lock
 *   - getSystemName() returns systemName string
 *
 * PrismaService and CacheService are mocked.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { WhitelabelService } from '../../../src/modules/whitelabel/whitelabel.service.js';
import { PrismaService } from '../../../src/database/prisma.service.js';
import { CacheService } from '../../../src/common/services/cache.service.js';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockCacheService: Record<string, jest.Mock> = {
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue(undefined),
  del: jest.fn().mockResolvedValue(undefined),
};

const mockConfigRow = {
  id: 'wl-uuid-1',
  systemName: 'CareKit Clinic',
  systemNameAr: 'عيادة كيركت',
  productTagline: null,
  logoUrl: 'https://logo.png',
  faviconUrl: null,
  colorPrimary: '#354FD8',
  colorPrimaryLight: '#5B72E8',
  colorPrimaryDark: '#2438B0',
  colorAccent: '#82CC17',
  colorAccentDark: '#5A9010',
  colorBackground: '#EEF1F8',
  fontFamily: 'IBM Plex Sans Arabic',
  fontUrl: null,
  domain: null,
  clinicCanEdit: true,
  createdAt: new Date('2026-03-01'),
  updatedAt: new Date('2026-03-01'),
};

const mockPrismaService: Record<string, unknown> = {
  whiteLabelConfig: {
    findFirstOrThrow: jest.fn().mockResolvedValue(mockConfigRow),
    update: jest.fn().mockResolvedValue(mockConfigRow),
  },
};

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('WhitelabelService', () => {
  let service: WhitelabelService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WhitelabelService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: CacheService, useValue: mockCacheService },
      ],
    }).compile();

    service = module.get<WhitelabelService>(WhitelabelService);

    jest.clearAllMocks();
    mockCacheService.get.mockResolvedValue(null);
    (
      mockPrismaService.whiteLabelConfig as Record<string, jest.Mock>
    ).findFirstOrThrow.mockResolvedValue(mockConfigRow);
    (
      mockPrismaService.whiteLabelConfig as Record<string, jest.Mock>
    ).update.mockResolvedValue(mockConfigRow);
  });

  // ─── get ──────────────────────────────────────────────────────────────

  describe('get', () => {
    it('should return cached value without hitting DB when cache is warm', async () => {
      mockCacheService.get.mockResolvedValue(mockConfigRow);

      const result = await service.get();

      expect(result).toEqual(mockConfigRow);
      expect(
        (mockPrismaService.whiteLabelConfig as Record<string, jest.Mock>)
          .findFirstOrThrow,
      ).not.toHaveBeenCalled();
    });

    it('should query DB and cache result when cache is empty', async () => {
      const result = await service.get();

      expect(result).toEqual(mockConfigRow);
      expect(
        (mockPrismaService.whiteLabelConfig as Record<string, jest.Mock>)
          .findFirstOrThrow,
      ).toHaveBeenCalled();
      expect(mockCacheService.set).toHaveBeenCalled();
    });
  });

  // ─── getPublicBranding ────────────────────────────────────────────────

  describe('getPublicBranding', () => {
    it('should return cached value without hitting DB when cache is warm', async () => {
      const cached = { systemName: 'CareKit', logoUrl: 'https://logo.png' };
      mockCacheService.get.mockResolvedValue(cached);

      const result = await service.getPublicBranding();

      expect(result).toEqual(cached);
    });

    it('should return public branding subset from config', async () => {
      const result = await service.getPublicBranding();

      expect(result.systemName).toBe('CareKit Clinic');
      expect(result.systemNameAr).toBe('عيادة كيركت');
      expect(result.logoUrl).toBe('https://logo.png');
      expect(result.colorPrimary).toBe('#354FD8');
      expect(result.colorAccent).toBe('#82CC17');
      expect(mockCacheService.set).toHaveBeenCalled();
    });
  });

  // ─── update ───────────────────────────────────────────────────────────

  describe('update', () => {
    it('should update config and invalidate cache', async () => {
      const dto = { systemName: 'Updated Clinic' };
      const updated = { ...mockConfigRow, ...dto };
      (
        mockPrismaService.whiteLabelConfig as Record<string, jest.Mock>
      ).update.mockResolvedValue(updated);

      const result = await service.update(
        dto as Parameters<typeof service.update>[0],
      );

      expect(result.systemName).toBe('Updated Clinic');
      expect(mockCacheService.del).toHaveBeenCalled();
    });

    it('should throw ForbiddenException when clinicCanEdit is false', async () => {
      (
        mockPrismaService.whiteLabelConfig as Record<string, jest.Mock>
      ).findFirstOrThrow.mockResolvedValue({
        ...mockConfigRow,
        clinicCanEdit: false,
      });

      await expect(
        service.update({ systemName: 'Locked' } as Parameters<
          typeof service.update
        >[0]),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ─── adminUpdate ──────────────────────────────────────────────────────

  describe('adminUpdate', () => {
    it('should update config bypassing clinicCanEdit lock', async () => {
      (
        mockPrismaService.whiteLabelConfig as Record<string, jest.Mock>
      ).findFirstOrThrow.mockResolvedValue({
        ...mockConfigRow,
        clinicCanEdit: false,
      });
      const updated = { ...mockConfigRow, systemName: 'Admin Updated' };
      (
        mockPrismaService.whiteLabelConfig as Record<string, jest.Mock>
      ).update.mockResolvedValue(updated);

      const result = await service.adminUpdate({
        systemName: 'Admin Updated',
      } as Parameters<typeof service.adminUpdate>[0]);

      expect(result.systemName).toBe('Admin Updated');
    });
  });

  // ─── getSystemName ────────────────────────────────────────────────────

  describe('getSystemName', () => {
    it('should return the systemName from config', async () => {
      const result = await service.getSystemName();

      expect(result).toBe('CareKit Clinic');
    });
  });
});
