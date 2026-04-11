import { Test, TestingModule } from '@nestjs/testing';
import { DepartmentsController } from '../../../src/modules/departments/departments.controller.js';
import { DepartmentsService } from '../../../src/modules/departments/departments.service.js';
import { JwtAuthGuard } from '../../../src/common/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../../../src/common/guards/permissions.guard.js';
import { FeatureFlagGuard } from '../../../src/common/guards/feature-flag.guard.js';
import { CreateDepartmentDto } from '../../../src/modules/departments/dto/create-department.dto.js';
import { UpdateDepartmentDto } from '../../../src/modules/departments/dto/update-department.dto.js';
import { ReorderDepartmentsDto } from '../../../src/modules/departments/dto/reorder-departments.dto.js';
import { DepartmentListQueryDto } from '../../../src/modules/departments/dto/department-list-query.dto.js';

const mockService = {
  findAll: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
  reorder: jest.fn(),
};

describe('DepartmentsController', () => {
  let controller: DepartmentsController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DepartmentsController],
      providers: [{ provide: DepartmentsService, useValue: mockService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(FeatureFlagGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<DepartmentsController>(DepartmentsController);
  });

  describe('findAll', () => {
    it('should delegate to service.findAll with query', async () => {
      const query: DepartmentListQueryDto = { page: 1, perPage: 10 };
      const result = { items: [], meta: { total: 0 } };
      mockService.findAll.mockResolvedValue(result);

      expect(await controller.findAll(query)).toEqual(result);
      expect(mockService.findAll).toHaveBeenCalledWith(query);
    });
  });

  describe('findOne', () => {
    it('should delegate to service.findOne with id', async () => {
      const dept = { id: 'dept-1', nameAr: 'قسم' };
      mockService.findOne.mockResolvedValue(dept);

      expect(await controller.findOne('dept-1')).toEqual(dept);
      expect(mockService.findOne).toHaveBeenCalledWith('dept-1');
    });
  });

  describe('create', () => {
    it('should delegate to service.create with dto', async () => {
      const dto: CreateDepartmentDto = { nameAr: 'قسم جديد', nameEn: 'New' };
      const created = { id: 'dept-2', ...dto };
      mockService.create.mockResolvedValue(created);

      expect(await controller.create(dto)).toEqual(created);
      expect(mockService.create).toHaveBeenCalledWith(dto);
    });
  });

  describe('update', () => {
    it('should delegate to service.update with id and dto', async () => {
      const dto: UpdateDepartmentDto = { nameAr: 'محدث' };
      const updated = { id: 'dept-1', nameAr: 'محدث' };
      mockService.update.mockResolvedValue(updated);

      expect(await controller.update('dept-1', dto)).toEqual(updated);
      expect(mockService.update).toHaveBeenCalledWith('dept-1', dto);
    });
  });

  describe('remove', () => {
    it('should delegate to service.remove with id', async () => {
      mockService.remove.mockResolvedValue({ deleted: true });

      expect(await controller.remove('dept-1')).toEqual({ deleted: true });
      expect(mockService.remove).toHaveBeenCalledWith('dept-1');
    });
  });

  describe('reorder', () => {
    it('should delegate to service.reorder with dto', async () => {
      const dto: ReorderDepartmentsDto = {
        items: [{ id: 'dept-1', sortOrder: 0 }],
      };
      mockService.reorder.mockResolvedValue({ reordered: true });

      expect(await controller.reorder(dto)).toEqual({ reordered: true });
      expect(mockService.reorder).toHaveBeenCalledWith(dto);
    });
  });
});
