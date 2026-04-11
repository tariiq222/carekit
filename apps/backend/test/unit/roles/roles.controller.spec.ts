import { Test, TestingModule } from '@nestjs/testing';
import { RolesController } from '../../../src/modules/roles/roles.controller.js';
import { RolesService } from '../../../src/modules/roles/roles.service.js';
import { JwtAuthGuard } from '../../../src/common/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../../../src/common/guards/permissions.guard.js';

const mockService = {
  findAll: jest.fn(),
  create: jest.fn(),
  delete: jest.fn(),
  assignPermission: jest.fn(),
  removePermission: jest.fn(),
};

const mockRole = {
  id: 'r1',
  name: 'Receptionist',
  slug: 'receptionist',
  description: 'Front desk',
  isDefault: false,
  isSystem: false,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-02'),
  rolePermissions: [
    {
      permission: { id: 'p1', module: 'bookings', action: 'view' },
    },
  ],
};

describe('RolesController', () => {
  let controller: RolesController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RolesController],
      providers: [{ provide: RolesService, useValue: mockService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<RolesController>(RolesController);
  });

  describe('findAll', () => {
    it('should map rolePermissions to flat permissions array', async () => {
      mockService.findAll.mockResolvedValue([mockRole]);

      const result = await controller.findAll();

      expect(result).toEqual([
        {
          id: 'r1',
          name: 'Receptionist',
          slug: 'receptionist',
          description: 'Front desk',
          isDefault: false,
          isSystem: false,
          createdAt: mockRole.createdAt,
          updatedAt: mockRole.updatedAt,
          permissions: [{ id: 'p1', module: 'bookings', action: 'view' }],
        },
      ]);
    });
  });

  describe('create', () => {
    it('should map response with permissions', async () => {
      const dto = { name: 'Accountant' } as any;
      mockService.create.mockResolvedValue(mockRole);

      const result = await controller.create(dto);

      expect(mockService.create).toHaveBeenCalledWith(dto);
      expect(result.permissions).toEqual([
        { id: 'p1', module: 'bookings', action: 'view' },
      ]);
    });
  });

  describe('delete', () => {
    it('should delegate to service.delete', async () => {
      mockService.delete.mockResolvedValue({ deleted: true });
      expect(await controller.delete('r1')).toEqual({ deleted: true });
      expect(mockService.delete).toHaveBeenCalledWith('r1');
    });
  });

  describe('assignPermission', () => {
    it('should delegate to service.assignPermission', async () => {
      const dto = { module: 'bookings', action: 'create' } as any;
      mockService.assignPermission.mockResolvedValue({ assigned: true });

      const result = await controller.assignPermission('r1', dto);

      expect(mockService.assignPermission).toHaveBeenCalledWith(
        'r1',
        'bookings',
        'create',
      );
      expect(result).toEqual({ assigned: true });
    });
  });

  describe('removePermissionPost', () => {
    it('should delegate to service.removePermission (proxy-safe POST)', async () => {
      const dto = { module: 'bookings', action: 'create' } as any;
      mockService.removePermission.mockResolvedValue({ removed: true });

      const result = await controller.removePermissionPost('r1', dto);

      expect(mockService.removePermission).toHaveBeenCalledWith(
        'r1',
        'bookings',
        'create',
      );
      expect(result).toEqual({ removed: true });
    });
  });

  describe('removePermission', () => {
    it('should delegate to service.removePermission (deprecated DELETE)', async () => {
      const dto = { module: 'bookings', action: 'view' } as any;
      mockService.removePermission.mockResolvedValue({ removed: true });

      const result = await controller.removePermission('r1', dto);

      expect(mockService.removePermission).toHaveBeenCalledWith(
        'r1',
        'bookings',
        'view',
      );
    });
  });
});
