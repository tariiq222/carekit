import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from '../../../src/modules/users/users.controller.js';
import { UsersService } from '../../../src/modules/users/users.service.js';
import { UserRolesService } from '../../../src/modules/users/user-roles.service.js';
import { JwtAuthGuard } from '../../../src/common/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../../../src/common/guards/permissions.guard.js';

const mockUsersService = {
  findAll: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  softDelete: jest.fn(),
  activate: jest.fn(),
  deactivate: jest.fn(),
};

const mockUserRolesService = {
  assignRole: jest.fn(),
  removeRole: jest.fn(),
};

const mockUser = { id: 'user-1' };

describe('UsersController', () => {
  let controller: UsersController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        { provide: UsersService, useValue: mockUsersService },
        { provide: UserRolesService, useValue: mockUserRolesService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<UsersController>(UsersController);
  });

  describe('findAll', () => {
    it('should parse query params and delegate', async () => {
      const data = [{ id: 'u1' }];
      mockUsersService.findAll.mockResolvedValue(data);

      const result = await controller.findAll(
        '1',
        '20',
        'name',
        'asc',
        'ahmed',
        'admin',
        'true',
      );

      expect(mockUsersService.findAll).toHaveBeenCalledWith({
        page: 1,
        perPage: 20,
        sortBy: 'name',
        sortOrder: 'asc',
        search: 'ahmed',
        role: 'admin',
        isActive: true,
      });
      expect(result).toEqual(data);
    });

    it('should pass undefined for missing optional params', async () => {
      mockUsersService.findAll.mockResolvedValue([]);

      await controller.findAll(
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
      );

      expect(mockUsersService.findAll).toHaveBeenCalledWith({
        page: undefined,
        perPage: undefined,
        sortBy: undefined,
        sortOrder: undefined,
        search: undefined,
        role: undefined,
        isActive: undefined,
      });
    });
  });

  describe('findOne', () => {
    it('should delegate with id', async () => {
      const user = { id: 'u1', name: 'Ahmed' };
      mockUsersService.findOne.mockResolvedValue(user);

      expect(await controller.findOne('u1')).toEqual(user);
      expect(mockUsersService.findOne).toHaveBeenCalledWith('u1');
    });
  });

  describe('create', () => {
    it('should pass dto and current user id, wrap in success envelope', async () => {
      const dto = { email: 'new@clinic.com' } as any;
      const created = { id: 'u2', email: 'new@clinic.com' };
      mockUsersService.create.mockResolvedValue(created);

      const result = await controller.create(dto, mockUser);

      expect(result).toEqual({
        success: true,
        data: created,
        message: 'User created successfully',
      });
      expect(mockUsersService.create).toHaveBeenCalledWith(dto, 'user-1');
    });
  });

  describe('update', () => {
    it('should delegate with id and dto', async () => {
      const dto = { firstName: 'Updated' } as any;
      const updated = { id: 'u1', firstName: 'Updated' };
      mockUsersService.update.mockResolvedValue(updated);

      expect(await controller.update('u1', dto)).toEqual(updated);
      expect(mockUsersService.update).toHaveBeenCalledWith('u1', dto);
    });
  });

  describe('delete', () => {
    it('should call softDelete with id and current user id', async () => {
      mockUsersService.softDelete.mockResolvedValue(undefined);

      expect(await controller.delete('u1', mockUser)).toEqual({
        deleted: true,
      });
      expect(mockUsersService.softDelete).toHaveBeenCalledWith('u1', 'user-1');
    });
  });

  describe('activate', () => {
    it('should delegate with id', async () => {
      const result = { id: 'u1', isActive: true };
      mockUsersService.activate.mockResolvedValue(result);

      expect(await controller.activate('u1')).toEqual(result);
      expect(mockUsersService.activate).toHaveBeenCalledWith('u1');
    });
  });

  describe('deactivate', () => {
    it('should pass id and current user id', async () => {
      const result = { id: 'u1', isActive: false };
      mockUsersService.deactivate.mockResolvedValue(result);

      expect(await controller.deactivate('u1', mockUser)).toEqual(result);
      expect(mockUsersService.deactivate).toHaveBeenCalledWith('u1', 'user-1');
    });
  });

  describe('assignRole', () => {
    it('should pass all params to userRolesService', async () => {
      const dto = { roleId: 'r1', roleSlug: 'admin' } as any;
      mockUserRolesService.assignRole.mockResolvedValue(undefined);
      const requester = { id: 'req-1' };

      const result = await controller.assignRole('u1', dto, requester);

      expect(result).toEqual({
        success: true,
        message: 'Role assigned successfully',
      });
      expect(mockUserRolesService.assignRole).toHaveBeenCalledWith(
        'u1',
        'r1',
        'admin',
        'req-1',
      );
    });
  });

  describe('removeRole', () => {
    it('should delegate with userId and roleId', async () => {
      mockUserRolesService.removeRole.mockResolvedValue(undefined);

      expect(await controller.removeRole('u1', 'r1')).toEqual({
        removed: true,
      });
      expect(mockUserRolesService.removeRole).toHaveBeenCalledWith('u1', 'r1');
    });
  });
});
