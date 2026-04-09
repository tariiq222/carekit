/**
 * FeatureFlagsController Unit Tests — delegation only
 */
import { Test, TestingModule } from '@nestjs/testing';
import { FeatureFlagsController } from '../../../src/modules/feature-flags/feature-flags.controller.js';
import { FeatureFlagsService } from '../../../src/modules/feature-flags/feature-flags.service.js';
import { JwtAuthGuard } from '../../../src/common/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../../../src/common/guards/permissions.guard.js';

const mockService = {
  findAll: jest.fn(),
  getMap: jest.fn(),
  toggle: jest.fn(),
};

describe('FeatureFlagsController', () => {
  let controller: FeatureFlagsController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [FeatureFlagsController],
      providers: [{ provide: FeatureFlagsService, useValue: mockService }],
    })
      .overrideGuard(JwtAuthGuard).useValue({ canActivate: () => true })
      .overrideGuard(PermissionsGuard).useValue({ canActivate: () => true })
      .compile();

    controller = module.get<FeatureFlagsController>(FeatureFlagsController);
  });

  describe('findAll', () => {
    it('should delegate to service.findAll and return result', async () => {
      const flags = [{ key: 'dark_mode', enabled: true }];
      mockService.findAll.mockResolvedValue(flags);

      const result = await controller.findAll();

      expect(mockService.findAll).toHaveBeenCalledTimes(1);
      expect(result).toEqual(flags);
    });
  });

  describe('getMap', () => {
    it('should delegate to service.getMap and return result', async () => {
      const map = { dark_mode: true, beta: false };
      mockService.getMap.mockResolvedValue(map);

      const result = await controller.getMap();

      expect(mockService.getMap).toHaveBeenCalledTimes(1);
      expect(result).toEqual(map);
    });
  });

  describe('toggle', () => {
    it('should delegate to service.toggle with key and enabled value', async () => {
      const updated = { key: 'dark_mode', enabled: false };
      mockService.toggle.mockResolvedValue(updated);

      const result = await controller.toggle('dark_mode', { enabled: false });

      expect(mockService.toggle).toHaveBeenCalledWith('dark_mode', false);
      expect(result).toEqual(updated);
    });

    it('should pass enabled=true correctly', async () => {
      mockService.toggle.mockResolvedValue({ key: 'beta', enabled: true });

      await controller.toggle('beta', { enabled: true });

      expect(mockService.toggle).toHaveBeenCalledWith('beta', true);
    });
  });
});
