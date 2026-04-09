import { Test, TestingModule } from '@nestjs/testing';
import { SpecialtiesController } from '../../../src/modules/specialties/specialties.controller.js';
import { SpecialtiesService } from '../../../src/modules/specialties/specialties.service.js';
import { JwtAuthGuard } from '../../../src/common/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../../../src/common/guards/permissions.guard.js';

const mockService = {
  findAll: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
};

describe('SpecialtiesController', () => {
  let controller: SpecialtiesController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SpecialtiesController],
      providers: [{ provide: SpecialtiesService, useValue: mockService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<SpecialtiesController>(SpecialtiesController);
  });

  describe('findAll', () => {
    it('should delegate to service.findAll', async () => {
      const data = [{ id: 's1', nameAr: 'طب عام' }];
      mockService.findAll.mockResolvedValue(data);
      expect(await controller.findAll()).toEqual(data);
      expect(mockService.findAll).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should delegate to service.findOne with id', async () => {
      const item = { id: 's1', nameAr: 'طب عام' };
      mockService.findOne.mockResolvedValue(item);
      expect(await controller.findOne('s1')).toEqual(item);
      expect(mockService.findOne).toHaveBeenCalledWith('s1');
    });
  });

  describe('create', () => {
    it('should delegate to service.create with dto', async () => {
      const dto = { nameAr: 'أسنان', nameEn: 'Dental' } as any;
      const created = { id: 's2', ...dto };
      mockService.create.mockResolvedValue(created);
      expect(await controller.create(dto)).toEqual(created);
      expect(mockService.create).toHaveBeenCalledWith(dto);
    });
  });

  describe('update', () => {
    it('should delegate to service.update with id and dto', async () => {
      const dto = { nameAr: 'أسنان محدث' } as any;
      const updated = { id: 's1', ...dto };
      mockService.update.mockResolvedValue(updated);
      expect(await controller.update('s1', dto)).toEqual(updated);
      expect(mockService.update).toHaveBeenCalledWith('s1', dto);
    });
  });

  describe('delete', () => {
    it('should delegate to service.delete with id', async () => {
      mockService.delete.mockResolvedValue({ deleted: true });
      expect(await controller.delete('s1')).toEqual({ deleted: true });
      expect(mockService.delete).toHaveBeenCalledWith('s1');
    });
  });
});
