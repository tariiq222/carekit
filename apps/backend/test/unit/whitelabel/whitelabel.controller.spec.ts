import { Test, TestingModule } from '@nestjs/testing';
import { WhitelabelController } from '../../../src/modules/whitelabel/whitelabel.controller.js';
import { WhitelabelService } from '../../../src/modules/whitelabel/whitelabel.service.js';
import { JwtAuthGuard } from '../../../src/common/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../../../src/common/guards/permissions.guard.js';

const mockService = {
  getPublicBranding: jest.fn(),
  get: jest.fn(),
  update: jest.fn(),
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
      const branding = { systemName: 'CareKit', primaryColor: '#354FD8' };
      mockService.getPublicBranding.mockResolvedValue(branding);
      expect(await controller.getPublicBranding()).toEqual(branding);
    });
  });

  describe('get', () => {
    it('should delegate to service.get', async () => {
      const config = { id: 'wl-1', systemName: 'CareKit' };
      mockService.get.mockResolvedValue(config);
      expect(await controller.get()).toEqual(config);
    });
  });

  describe('update', () => {
    it('should delegate to service.update with dto', async () => {
      const dto = { systemName: 'Updated' } as Parameters<
        typeof controller.update
      >[0];
      const result = { id: 'wl-1', systemName: 'Updated' };
      mockService.update.mockResolvedValue(result);
      expect(await controller.update(dto)).toEqual(result);
      expect(mockService.update).toHaveBeenCalledWith(dto);
    });
  });
});
