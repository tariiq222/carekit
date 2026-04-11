/**
 * LicenseController Unit Tests — delegation only
 */
import { Test, TestingModule } from '@nestjs/testing';
import { LicenseController } from '../../../src/modules/license/license.controller.js';
import { LicenseService } from '../../../src/modules/license/license.service.js';
import { JwtAuthGuard } from '../../../src/common/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../../../src/common/guards/permissions.guard.js';

const baseLicense = {
  id: 'lic-1',
  hasCoupons: true,
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

const mockService = {
  get: jest.fn(),
  update: jest.fn(),
  getFeaturesWithStatus: jest.fn(),
};

describe('LicenseController', () => {
  let controller: LicenseController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [LicenseController],
      providers: [{ provide: LicenseService, useValue: mockService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<LicenseController>(LicenseController);
  });

  describe('get', () => {
    it('delegates to service.get and returns license config', async () => {
      mockService.get.mockResolvedValue(baseLicense);

      const result = await controller.get();

      expect(mockService.get).toHaveBeenCalledTimes(1);
      expect(result).toEqual(baseLicense);
    });
  });

  describe('update', () => {
    it('delegates to service.update with dto and returns updated config', async () => {
      const dto = { hasCoupons: false };
      const updated = { ...baseLicense, hasCoupons: false };
      mockService.update.mockResolvedValue(updated);

      const result = await controller.update(dto);

      expect(mockService.update).toHaveBeenCalledWith(dto);
      expect(result).toEqual(updated);
    });

    it('passes partial update correctly', async () => {
      const dto = { hasCoupons: false };
      mockService.update.mockResolvedValue({ ...baseLicense, ...dto });

      await controller.update(dto);

      expect(mockService.update).toHaveBeenCalledWith(dto);
    });
  });

  describe('getFeatures', () => {
    it('delegates to service.getFeaturesWithStatus and returns features', async () => {
      const features = [
        {
          key: 'coupons',
          licensed: true,
          enabled: true,
          nameAr: 'الكوبونات',
          nameEn: 'Coupons',
        },
        {
          licensed: false,
          enabled: false,
          nameAr: 'بطاقات الهدايا',
          nameEn: 'Gift Cards',
        },
      ];
      mockService.getFeaturesWithStatus.mockResolvedValue(features);

      const result = await controller.getFeatures();

      expect(mockService.getFeaturesWithStatus).toHaveBeenCalledTimes(1);
      expect(result).toEqual(features);
    });
  });
});
