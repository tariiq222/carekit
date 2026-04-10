/**
 * BranchesController Unit Tests — delegation only
 */
import { Test, TestingModule } from '@nestjs/testing';
import { BranchesController } from '../../../src/modules/branches/branches.controller.js';
import { BranchesService } from '../../../src/modules/branches/branches.service.js';
import { JwtAuthGuard } from '../../../src/common/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../../../src/common/guards/permissions.guard.js';
import { FeatureFlagGuard } from '../../../src/common/guards/feature-flag.guard.js';
import { uuidPipe } from '../../../src/common/pipes/uuid.pipe.js';

const mockService = {
  getPublicBranches: jest.fn(),
  findAll: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  getPractitioners: jest.fn(),
  assignPractitioners: jest.fn(),
  removePractitioner: jest.fn(),
};

const branch = { id: 'branch-1', nameEn: 'Main', nameAr: 'الرئيسي' };

describe('BranchesController', () => {
  let controller: BranchesController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [BranchesController],
      providers: [{ provide: BranchesService, useValue: mockService }],
    })
      .overrideGuard(JwtAuthGuard).useValue({ canActivate: () => true })
      .overrideGuard(PermissionsGuard).useValue({ canActivate: () => true })
      .overrideGuard(FeatureFlagGuard).useValue({ canActivate: () => true })
      .overridePipe(uuidPipe).useValue({ transform: (v: string) => v })
      .compile();

    controller = module.get<BranchesController>(BranchesController);
  });

  describe('getPublicBranches', () => {
    it('delegates to service.getPublicBranches', async () => {
      mockService.getPublicBranches.mockResolvedValue([branch]);

      const result = await controller.getPublicBranches();

      expect(mockService.getPublicBranches).toHaveBeenCalledTimes(1);
      expect(result).toEqual([branch]);
    });
  });

  describe('findAll', () => {
    it('delegates to service.findAll with query', async () => {
      const query = { page: 1, perPage: 10 };
      const paginated = { items: [branch], meta: { total: 1, page: 1, perPage: 10, totalPages: 1 } };
      mockService.findAll.mockResolvedValue(paginated);

      const result = await controller.findAll(query as any);

      expect(mockService.findAll).toHaveBeenCalledWith(query);
      expect(result).toEqual(paginated);
    });
  });

  describe('findById', () => {
    it('delegates to service.findById with id', async () => {
      mockService.findById.mockResolvedValue(branch);

      const result = await controller.findById('branch-1');

      expect(mockService.findById).toHaveBeenCalledWith('branch-1');
      expect(result).toEqual(branch);
    });
  });

  describe('create', () => {
    it('delegates to service.create with dto', async () => {
      const dto = { nameEn: 'New Branch', nameAr: 'فرع جديد', address: 'Riyadh', phone: '+966500000000', email: 'br@test.com' };
      mockService.create.mockResolvedValue({ ...dto, id: 'branch-2' });

      const result = await controller.create(dto as any);

      expect(mockService.create).toHaveBeenCalledWith(dto);
      expect(result).toMatchObject({ nameEn: 'New Branch' });
    });
  });

  describe('update', () => {
    it('delegates to service.update with id and dto', async () => {
      const dto = { nameEn: 'Updated' };
      mockService.update.mockResolvedValue({ ...branch, nameEn: 'Updated' });

      const result = await controller.update('branch-1', dto as any);

      expect(mockService.update).toHaveBeenCalledWith('branch-1', dto);
      expect(result).toMatchObject({ nameEn: 'Updated' });
    });
  });

  describe('delete', () => {
    it('delegates to service.delete with id and returns result', async () => {
      mockService.delete.mockResolvedValue({ deleted: true });

      const result = await controller.delete('branch-1');

      expect(mockService.delete).toHaveBeenCalledWith('branch-1');
      expect(result).toEqual({ deleted: true });
    });
  });

  describe('getPractitioners', () => {
    it('delegates to service.getPractitioners with branchId', async () => {
      const practitioners = [{ id: 'prac-1' }];
      mockService.getPractitioners.mockResolvedValue(practitioners);

      const result = await controller.getPractitioners('branch-1');

      expect(mockService.getPractitioners).toHaveBeenCalledWith('branch-1');
      expect(result).toEqual(practitioners);
    });
  });

  describe('assignPractitioners', () => {
    it('delegates to service.assignPractitioners with id and practitionerIds', async () => {
      const dto = { practitionerIds: ['prac-1', 'prac-2'] };
      mockService.assignPractitioners.mockResolvedValue([{ id: 'prac-1' }, { id: 'prac-2' }]);

      const result = await controller.assignPractitioners('branch-1', dto as any);

      expect(mockService.assignPractitioners).toHaveBeenCalledWith('branch-1', ['prac-1', 'prac-2']);
      expect(result).toHaveLength(2);
    });
  });

  describe('removePractitioner', () => {
    it('delegates to service.removePractitioner with branchId and practitionerId', async () => {
      mockService.removePractitioner.mockResolvedValue({ removed: true });

      const result = await controller.removePractitioner('branch-1', 'prac-1');

      expect(mockService.removePractitioner).toHaveBeenCalledWith('branch-1', 'prac-1');
      expect(result).toEqual({ removed: true });
    });
  });
});
