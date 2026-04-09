import { Test, TestingModule } from '@nestjs/testing';
import { WhitelabelController } from '../../../src/modules/whitelabel/whitelabel.controller.js';
import { WhitelabelService } from '../../../src/modules/whitelabel/whitelabel.service.js';
import { JwtAuthGuard } from '../../../src/common/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../../../src/common/guards/permissions.guard.js';

const mockService = {
  getPublicBranding: jest.fn(),
  getConfig: jest.fn(),
  getConfigMap: jest.fn(),
  updateConfig: jest.fn(),
  getConfigByKey: jest.fn(),
  deleteConfig: jest.fn(),
};

describe('WhitelabelController', () => {
  let controller: WhitelabelController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WhitelabelController],
      providers: [{ provide: WhitelabelService, useValue: mockService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<WhitelabelController>(WhitelabelController);
  });

  describe('getPublicBranding', () => {
    it('should delegate to service.getPublicBranding', async () => {
      const branding = { logo: 'url', primaryColor: '#354FD8' };
      mockService.getPublicBranding.mockResolvedValue(branding);
      expect(await controller.getPublicBranding()).toEqual(branding);
    });
  });

  describe('getConfig', () => {
    it('should delegate to service.getConfig', async () => {
      const config = [{ key: 'logo', value: 'url' }];
      mockService.getConfig.mockResolvedValue(config);
      expect(await controller.getConfig()).toEqual(config);
    });
  });

  describe('getConfigMap', () => {
    it('should delegate to service.getConfigMap', async () => {
      const map = { logo: 'url', name: 'CareKit' };
      mockService.getConfigMap.mockResolvedValue(map);
      expect(await controller.getConfigMap()).toEqual(map);
    });
  });

  describe('updateConfig', () => {
    it('should delegate to service.updateConfig with dto', async () => {
      const dto = { items: [{ key: 'logo', value: 'new-url' }] } as any;
      const result = { updated: 1 };
      mockService.updateConfig.mockResolvedValue(result);
      expect(await controller.updateConfig(dto)).toEqual(result);
      expect(mockService.updateConfig).toHaveBeenCalledWith(dto);
    });
  });

  describe('getConfigByKey', () => {
    it('should delegate to service.getConfigByKey', async () => {
      const entry = { key: 'logo', value: 'url' };
      mockService.getConfigByKey.mockResolvedValue(entry);
      expect(await controller.getConfigByKey('logo')).toEqual(entry);
      expect(mockService.getConfigByKey).toHaveBeenCalledWith('logo');
    });
  });

  describe('deleteConfig', () => {
    it('should delegate to service.deleteConfig', async () => {
      mockService.deleteConfig.mockResolvedValue({ deleted: true });
      expect(await controller.deleteConfig('logo')).toEqual({ deleted: true });
      expect(mockService.deleteConfig).toHaveBeenCalledWith('logo');
    });
  });
});
