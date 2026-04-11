import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ServicesController } from '../../../src/modules/services/services.controller.js';
import { ServiceCategoriesService } from '../../../src/modules/services/service-categories.service.js';
import { ServicesService } from '../../../src/modules/services/services.service.js';
import { ServicesAvatarService } from '../../../src/modules/services/services-avatar.service.js';
import { DurationOptionsService } from '../../../src/modules/services/duration-options.service.js';
import { ServiceBookingTypeService } from '../../../src/modules/services/service-booking-type.service.js';
import { ServicePractitionersService } from '../../../src/modules/services/service-practitioners.service.js';
import { JwtAuthGuard } from '../../../src/common/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../../../src/common/guards/permissions.guard.js';

const mockCategories = {
  findAll: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
};
const mockServices = {
  findAll: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  softDelete: jest.fn(),
  setBranches: jest.fn(),
  clearBranches: jest.fn(),
  getIntakeForms: jest.fn(),
};
const mockAvatar = { uploadAvatar: jest.fn() };
const mockDuration = {
  getDurationOptions: jest.fn(),
  setDurationOptions: jest.fn(),
};
const mockBookingType = { getByService: jest.fn(), setBookingTypes: jest.fn() };
const mockPractitioners = { getPractitionersForService: jest.fn() };

describe('ServicesController', () => {
  let controller: ServicesController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ServicesController],
      providers: [
        { provide: ServiceCategoriesService, useValue: mockCategories },
        { provide: ServicesService, useValue: mockServices },
        { provide: ServicesAvatarService, useValue: mockAvatar },
        { provide: DurationOptionsService, useValue: mockDuration },
        { provide: ServiceBookingTypeService, useValue: mockBookingType },
        { provide: ServicePractitionersService, useValue: mockPractitioners },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<ServicesController>(ServicesController);
  });

  // Categories
  describe('findAllCategories', () => {
    it('should delegate to categoriesService.findAll', async () => {
      const cats = [{ id: 'cat1' }];
      mockCategories.findAll.mockResolvedValue(cats);
      expect(await controller.findAllCategories()).toEqual(cats);
    });
  });

  describe('createCategory', () => {
    it('should delegate with dto', async () => {
      const dto = { nameAr: 'تجميل' } as any;
      const created = { id: 'cat2', ...dto };
      mockCategories.create.mockResolvedValue(created);
      expect(await controller.createCategory(dto)).toEqual(created);
      expect(mockCategories.create).toHaveBeenCalledWith(dto);
    });
  });

  describe('updateCategory', () => {
    it('should delegate with id and dto', async () => {
      const dto = { nameAr: 'جلدية' } as any;
      mockCategories.update.mockResolvedValue({ id: 'cat1' });
      await controller.updateCategory('cat1', dto);
      expect(mockCategories.update).toHaveBeenCalledWith('cat1', dto);
    });
  });

  describe('deleteCategory', () => {
    it('should delegate with id', async () => {
      mockCategories.delete.mockResolvedValue({ deleted: true });
      expect(await controller.deleteCategory('cat1')).toEqual({
        deleted: true,
      });
    });
  });

  // Services CRUD
  describe('findAll', () => {
    it('should delegate with query', async () => {
      const query = { page: 1 } as any;
      const data = [{ id: 'svc1' }];
      mockServices.findAll.mockResolvedValue(data);
      expect(await controller.findAll(query)).toEqual(data);
      expect(mockServices.findAll).toHaveBeenCalledWith(query);
    });
  });

  describe('findOne', () => {
    it('should delegate with id', async () => {
      const svc = { id: 'svc1', nameAr: 'فحص' };
      mockServices.findOne.mockResolvedValue(svc);
      expect(await controller.findOne('svc1')).toEqual(svc);
    });
  });

  describe('create', () => {
    it('should delegate with dto', async () => {
      const dto = { nameAr: 'فحص جديد' } as any;
      mockServices.create.mockResolvedValue({ id: 'svc2' });
      await controller.create(dto);
      expect(mockServices.create).toHaveBeenCalledWith(dto);
    });
  });

  describe('update', () => {
    it('should delegate with id and dto', async () => {
      const dto = { nameAr: 'محدث' } as any;
      mockServices.update.mockResolvedValue({ id: 'svc1' });
      await controller.update('svc1', dto);
      expect(mockServices.update).toHaveBeenCalledWith('svc1', dto);
    });
  });

  describe('uploadAvatar', () => {
    it('should delegate to avatarService when file is provided', async () => {
      const file = {
        originalname: 'photo.jpg',
        buffer: Buffer.from('img'),
      } as any;
      mockAvatar.uploadAvatar.mockResolvedValue({
        url: 'https://cdn/photo.jpg',
      });

      const result = await controller.uploadAvatar('svc1', file);

      expect(mockAvatar.uploadAvatar).toHaveBeenCalledWith('svc1', file);
      expect(result).toEqual({ url: 'https://cdn/photo.jpg' });
    });

    it('should throw BadRequestException when no file', async () => {
      await expect(
        controller.uploadAvatar('svc1', undefined as any),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('setBranches', () => {
    it('should delegate and return updated: true', async () => {
      const dto = { branchIds: ['b1', 'b2'] } as any;
      mockServices.setBranches.mockResolvedValue(undefined);

      expect(await controller.setBranches('svc1', dto)).toEqual({
        updated: true,
      });
      expect(mockServices.setBranches).toHaveBeenCalledWith('svc1', [
        'b1',
        'b2',
      ]);
    });
  });

  describe('clearBranches', () => {
    it('should delegate and return cleared: true', async () => {
      mockServices.clearBranches.mockResolvedValue(undefined);

      expect(await controller.clearBranches('svc1')).toEqual({ cleared: true });
      expect(mockServices.clearBranches).toHaveBeenCalledWith('svc1');
    });
  });

  describe('softDelete', () => {
    it('should delegate with id', async () => {
      mockServices.softDelete.mockResolvedValue({ deleted: true });
      expect(await controller.softDelete('svc1')).toEqual({ deleted: true });
    });
  });

  describe('getIntakeForms', () => {
    it('should delegate with id', async () => {
      const forms = [{ id: 'f1' }];
      mockServices.getIntakeForms.mockResolvedValue(forms);
      expect(await controller.getIntakeForms('svc1')).toEqual(forms);
    });
  });

  // Duration Options
  describe('getDurationOptions', () => {
    it('should delegate with id', async () => {
      const opts = [{ duration: 30, price: 100 }];
      mockDuration.getDurationOptions.mockResolvedValue(opts);
      expect(await controller.getDurationOptions('svc1')).toEqual(opts);
    });
  });

  describe('setDurationOptions', () => {
    it('should delegate with id and dto', async () => {
      const dto = { options: [{ duration: 60, price: 200 }] } as any;
      mockDuration.setDurationOptions.mockResolvedValue({ updated: true });
      await controller.setDurationOptions('svc1', dto);
      expect(mockDuration.setDurationOptions).toHaveBeenCalledWith('svc1', dto);
    });
  });

  // Practitioners
  describe('getPractitioners', () => {
    it('should delegate with id and optional branchId', async () => {
      const practitioners = [{ id: 'p1' }];
      mockPractitioners.getPractitionersForService.mockResolvedValue(
        practitioners,
      );

      expect(await controller.getPractitioners('svc1', 'b1')).toEqual(
        practitioners,
      );
      expect(mockPractitioners.getPractitionersForService).toHaveBeenCalledWith(
        'svc1',
        'b1',
      );
    });

    it('should work without branchId', async () => {
      mockPractitioners.getPractitionersForService.mockResolvedValue([]);
      await controller.getPractitioners('svc1', undefined);
      expect(mockPractitioners.getPractitionersForService).toHaveBeenCalledWith(
        'svc1',
        undefined,
      );
    });
  });

  // Booking Types
  describe('getBookingTypes', () => {
    it('should delegate with id', async () => {
      const types = [{ id: 'bt1', name: 'in-clinic' }];
      mockBookingType.getByService.mockResolvedValue(types);
      expect(await controller.getBookingTypes('svc1')).toEqual(types);
    });
  });

  describe('setBookingTypes', () => {
    it('should delegate with id and dto', async () => {
      const dto = { types: ['in-clinic', 'video'] } as any;
      mockBookingType.setBookingTypes.mockResolvedValue({ updated: true });
      await controller.setBookingTypes('svc1', dto);
      expect(mockBookingType.setBookingTypes).toHaveBeenCalledWith('svc1', dto);
    });
  });
});
