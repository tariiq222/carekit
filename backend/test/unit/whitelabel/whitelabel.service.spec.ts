/**
 * CareKit — WhitelabelService Unit Tests
 *
 * Tests the WhitelabelService business logic in isolation:
 *   - getConfig returns array of all config entries ordered by key
 *   - getConfigMap returns { key: value } flat object
 *   - updateConfig upserts each item via Promise.all
 *   - getConfigByKey throws NotFoundException for missing key
 *   - deleteConfig throws NotFoundException for missing key
 *
 * PrismaService is mocked so tests run without a real database.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { WhitelabelService } from '../../../src/modules/whitelabel/whitelabel.service.js';
import { PrismaService } from '../../../src/database/prisma.service.js';
import { CacheService } from '../../../src/common/services/cache.service.js';
import { ClinicSettingsService } from '../../../src/modules/clinic/clinic-settings.service.js';
import { ConfigValueType } from '@prisma/client';

// ---------------------------------------------------------------------------
// Mock PrismaService
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockCacheService: any = {
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue(undefined),
  del: jest.fn().mockResolvedValue(undefined),
  delPattern: jest.fn().mockResolvedValue(undefined),
};

const mockClinicSettingsService: any = {
  getPaymentSettings: jest.fn().mockResolvedValue({
    paymentMoyasarEnabled: false,
    paymentAtClinicEnabled: true,
  }),
};

const mockPrismaService: any = {
  whiteLabelConfig: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    upsert: jest.fn(),
    delete: jest.fn(),
  },
  bookingSettings: {
    findFirst: jest.fn(),
  },
  $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
};

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const mockConfigItem = {
  id: 'config-uuid-1',
  key: 'clinic_name',
  value: 'CareKit Clinic',
  type: 'string' as ConfigValueType,
  description: 'Clinic display name (English)',
  createdAt: new Date('2026-03-01'),
  updatedAt: new Date('2026-03-01'),
};

const mockConfigItems = [
  mockConfigItem,
  {
    id: 'config-uuid-2',
    key: 'primary_color',
    value: '#2563EB',
    type: 'string' as ConfigValueType,
    description: 'Primary brand color (hex)',
    createdAt: new Date('2026-03-01'),
    updatedAt: new Date('2026-03-01'),
  },
  {
    id: 'config-uuid-3',
    key: 'social_media',
    value: '{}',
    type: 'json' as ConfigValueType,
    description: 'Social media links (JSON object)',
    createdAt: new Date('2026-03-01'),
    updatedAt: new Date('2026-03-01'),
  },
];

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
        { provide: ClinicSettingsService, useValue: mockClinicSettingsService },
      ],
    }).compile();

    service = module.get<WhitelabelService>(WhitelabelService);

    jest.clearAllMocks();
    // Restore default cache miss so tests that skip cache setup still hit DB
    mockCacheService.get.mockResolvedValue(null);
    mockPrismaService.bookingSettings.findFirst.mockResolvedValue({
      paymentMoyasarEnabled: false,
      paymentAtClinicEnabled: true,
      widgetShowPrice: true,
      widgetAnyPractitioner: false,
      widgetRedirectUrl: null,
      maxAdvanceBookingDays: 60,
    });
  });

  // ─────────────────────────────────────────────────────────────
  // getPublicBranding — Return cached or DB public branding keys
  // ─────────────────────────────────────────────────────────────

  describe('getPublicBranding', () => {
    it('should return cached value without hitting DB when cache is warm', async () => {
      const cached = { clinic_name: 'CareKit', logo_url: 'https://logo.png' };
      mockCacheService.get.mockResolvedValue(cached);

      const result = await service.getPublicBranding();

      expect(result).toEqual(cached);
      expect(mockPrismaService.whiteLabelConfig.findMany).not.toHaveBeenCalled();
    });

    it('should query DB and cache result when cache is empty', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockPrismaService.whiteLabelConfig.findMany.mockResolvedValue([
        { key: 'clinic_name', value: 'CareKit Clinic' },
        { key: 'logo_url', value: 'https://logo.png' },
      ]);

      const result = await service.getPublicBranding();

      expect(result).toEqual({
        clinic_name: 'CareKit Clinic',
        logo_url: 'https://logo.png',
        payment_moyasar_enabled: 'false',
        payment_at_clinic_enabled: 'true',
        widget_show_price: true,
        widget_any_practitioner: false,
        widget_redirect_url: null,
        widget_max_advance_days: 60,
      });
      expect(mockPrismaService.whiteLabelConfig.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ key: { in: expect.any(Array) } }),
          select: { key: true, value: true },
        }),
      );
      expect(mockCacheService.set).toHaveBeenCalled();
    });

    it('should return empty object when DB has no matching public keys', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockPrismaService.whiteLabelConfig.findMany.mockResolvedValue([]);

      const result = await service.getPublicBranding();

      expect(result).toEqual({
        payment_moyasar_enabled: 'false',
        payment_at_clinic_enabled: 'true',
        widget_show_price: true,
        widget_any_practitioner: false,
        widget_redirect_url: null,
        widget_max_advance_days: 60,
      });
    });
  });

  // ─────────────────────────────────────────────────────────────
  // getConfig — List all config entries
  // ─────────────────────────────────────────────────────────────

  describe('getConfig', () => {
    it('should return cached value without DB query when cache is warm', async () => {
      mockCacheService.get.mockResolvedValue(mockConfigItems);

      const result = await service.getConfig();

      expect(result).toEqual(mockConfigItems);
      expect(mockPrismaService.whiteLabelConfig.findMany).not.toHaveBeenCalled();
    });

    it('should return array of all config entries', async () => {
      mockPrismaService.whiteLabelConfig.findMany.mockResolvedValue(mockConfigItems);

      const result = await service.getConfig();

      expect(result).toBeInstanceOf(Array);
      expect(result).toHaveLength(3);
      expect(result[0].key).toBe('clinic_name');
    });

    it('should call findMany with orderBy key asc', async () => {
      mockPrismaService.whiteLabelConfig.findMany.mockResolvedValue(mockConfigItems);

      await service.getConfig();

      expect(mockPrismaService.whiteLabelConfig.findMany).toHaveBeenCalledWith({
        orderBy: { key: 'asc' },
      });
    });

    it('should return empty array when no config entries exist', async () => {
      mockPrismaService.whiteLabelConfig.findMany.mockResolvedValue([]);

      const result = await service.getConfig();

      expect(result).toEqual([]);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // getConfigMap — Return { key: value } object
  // ─────────────────────────────────────────────────────────────

  describe('getConfigMap', () => {
    it('should return a flat key-value object', async () => {
      mockPrismaService.whiteLabelConfig.findMany.mockResolvedValue(mockConfigItems);

      const result = await service.getConfigMap();

      expect(result).toEqual({
        clinic_name: 'CareKit Clinic',
        primary_color: '#2563EB',
        social_media: '{}',
      });
    });

    it('should return a plain object (not an array)', async () => {
      mockPrismaService.whiteLabelConfig.findMany.mockResolvedValue(mockConfigItems);

      const result = await service.getConfigMap();

      expect(result).not.toBeInstanceOf(Array);
      expect(typeof result).toBe('object');
    });

    it('should return empty object when no config entries exist', async () => {
      mockPrismaService.whiteLabelConfig.findMany.mockResolvedValue([]);

      const result = await service.getConfigMap();

      expect(result).toEqual({});
    });
  });

  // ─────────────────────────────────────────────────────────────
  // updateConfig — Upsert config entries
  // ─────────────────────────────────────────────────────────────

  describe('updateConfig', () => {
    it('should upsert each config item', async () => {
      const updatedItem = { ...mockConfigItem, value: 'Updated Clinic' };
      mockPrismaService.whiteLabelConfig.upsert.mockResolvedValue(updatedItem);
      mockPrismaService.whiteLabelConfig.findMany.mockResolvedValue([updatedItem]);

      const result = await service.updateConfig({
        configs: [{ key: 'clinic_name', value: 'Updated Clinic' }],
      });

      expect(mockPrismaService.whiteLabelConfig.upsert).toHaveBeenCalledTimes(1);
      expect(mockPrismaService.whiteLabelConfig.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { key: 'clinic_name' },
          create: expect.objectContaining({
            key: 'clinic_name',
            value: 'Updated Clinic',
          }),
          update: expect.objectContaining({
            value: 'Updated Clinic',
          }),
        }),
      );
      expect(result).toBeInstanceOf(Array);
    });

    it('should upsert multiple config items in parallel', async () => {
      mockPrismaService.whiteLabelConfig.upsert.mockResolvedValue(mockConfigItem);
      mockPrismaService.whiteLabelConfig.findMany.mockResolvedValue(mockConfigItems);

      await service.updateConfig({
        configs: [
          { key: 'clinic_name', value: 'New Name' },
          { key: 'primary_color', value: '#FF0000' },
        ],
      });

      expect(mockPrismaService.whiteLabelConfig.upsert).toHaveBeenCalledTimes(2);
    });

    it('should use string as default type when type is not provided', async () => {
      mockPrismaService.whiteLabelConfig.upsert.mockResolvedValue(mockConfigItem);
      mockPrismaService.whiteLabelConfig.findMany.mockResolvedValue([mockConfigItem]);

      await service.updateConfig({
        configs: [{ key: 'clinic_name', value: 'CareKit' }],
      });

      expect(mockPrismaService.whiteLabelConfig.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            type: 'string',
          }),
        }),
      );
    });

    it('should return the updated config array after upsert', async () => {
      const updatedItems = [{ ...mockConfigItem, value: 'Updated' }];
      mockPrismaService.whiteLabelConfig.upsert.mockResolvedValue(updatedItems[0]);
      mockPrismaService.whiteLabelConfig.findMany.mockResolvedValue(updatedItems);

      const result = await service.updateConfig({
        configs: [{ key: 'clinic_name', value: 'Updated' }],
      });

      expect(result).toEqual(updatedItems);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // getConfigByKey — Get single config entry
  // ─────────────────────────────────────────────────────────────

  describe('getConfigByKey', () => {
    it('should return the config item when key exists', async () => {
      mockPrismaService.whiteLabelConfig.findUnique.mockResolvedValue(mockConfigItem);

      const result = await service.getConfigByKey('clinic_name');

      expect(result).toBeDefined();
      expect(result.key).toBe('clinic_name');
      expect(result.value).toBe('CareKit Clinic');
      expect(mockPrismaService.whiteLabelConfig.findUnique).toHaveBeenCalledWith({
        where: { key: 'clinic_name' },
      });
    });

    it('should throw NotFoundException for missing key', async () => {
      mockPrismaService.whiteLabelConfig.findUnique.mockResolvedValue(null);

      await expect(service.getConfigByKey('non_existent_key')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException with meaningful message', async () => {
      mockPrismaService.whiteLabelConfig.findUnique.mockResolvedValue(null);

      await expect(service.getConfigByKey('missing_key')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─────────────────────────────────────────────────────────────
  // deleteConfig — Delete config entry by key
  // ─────────────────────────────────────────────────────────────

  describe('deleteConfig', () => {
    it('should delete and return the config item when key exists', async () => {
      mockPrismaService.whiteLabelConfig.findUnique.mockResolvedValue(mockConfigItem);
      mockPrismaService.whiteLabelConfig.delete.mockResolvedValue(mockConfigItem);

      const result = await service.deleteConfig('clinic_name');

      expect(result).toBeDefined();
      expect(result.key).toBe('clinic_name');
      expect(mockPrismaService.whiteLabelConfig.delete).toHaveBeenCalledWith({
        where: { key: 'clinic_name' },
      });
    });

    it('should throw NotFoundException for missing key', async () => {
      mockPrismaService.whiteLabelConfig.findUnique.mockResolvedValue(null);

      await expect(service.deleteConfig('non_existent_key')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should not call delete when key does not exist', async () => {
      mockPrismaService.whiteLabelConfig.findUnique.mockResolvedValue(null);

      await expect(service.deleteConfig('missing_key')).rejects.toThrow(
        NotFoundException,
      );

      expect(mockPrismaService.whiteLabelConfig.delete).not.toHaveBeenCalled();
    });
  });
});
