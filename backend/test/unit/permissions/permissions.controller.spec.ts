/**
 * PermissionsController Unit Tests — delegation only
 */
import { Test, TestingModule } from '@nestjs/testing';
import { PermissionsController } from '../../../src/modules/permissions/permissions.controller.js';
import { PermissionsService } from '../../../src/modules/permissions/permissions.service.js';
import { JwtAuthGuard } from '../../../src/common/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../../../src/common/guards/permissions.guard.js';

const mockService = {
  findAll: jest.fn(),
};

describe('PermissionsController', () => {
  let controller: PermissionsController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PermissionsController],
      providers: [{ provide: PermissionsService, useValue: mockService }],
    })
      .overrideGuard(JwtAuthGuard).useValue({ canActivate: () => true })
      .overrideGuard(PermissionsGuard).useValue({ canActivate: () => true })
      .compile();

    controller = module.get<PermissionsController>(PermissionsController);
  });

  describe('findAll', () => {
    it('delegates to service.findAll and returns all permissions', async () => {
      const permissions = [
        { id: 'p1', module: 'bookings', action: 'create' },
        { id: 'p2', module: 'bookings', action: 'view' },
        { id: 'p3', module: 'patients', action: 'view' },
      ];
      mockService.findAll.mockResolvedValue(permissions);

      const result = await controller.findAll();

      expect(mockService.findAll).toHaveBeenCalledTimes(1);
      expect(result).toEqual(permissions);
    });

    it('returns empty array when no permissions exist', async () => {
      mockService.findAll.mockResolvedValue([]);

      const result = await controller.findAll();

      expect(result).toEqual([]);
    });
  });
});
