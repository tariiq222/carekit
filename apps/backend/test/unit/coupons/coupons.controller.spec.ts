import { Test, TestingModule } from '@nestjs/testing';
import { CouponsController } from '../../../src/modules/coupons/coupons.controller.js';
import { CouponsService } from '../../../src/modules/coupons/coupons.service.js';
import { JwtAuthGuard } from '../../../src/common/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../../../src/common/guards/permissions.guard.js';
import { FeatureFlagGuard } from '../../../src/common/guards/feature-flag.guard.js';

const mockService = {
  findAll: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  applyCoupon: jest.fn(),
  validateCode: jest.fn(),
};

describe('CouponsController', () => {
  let controller: CouponsController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CouponsController],
      providers: [{ provide: CouponsService, useValue: mockService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(FeatureFlagGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<CouponsController>(CouponsController);
  });

  describe('findAll', () => {
    it('should wrap service result in success envelope', async () => {
      const coupons = [{ id: 'c1', code: 'SAVE10' }];
      mockService.findAll.mockResolvedValue(coupons);
      const query = { page: '1' } as any;

      const result = await controller.findAll(query);

      expect(result).toEqual({ success: true, data: coupons });
      expect(mockService.findAll).toHaveBeenCalledWith(query);
    });
  });

  describe('findById', () => {
    it('should wrap service result in success envelope', async () => {
      const coupon = { id: 'c1', code: 'SAVE10' };
      mockService.findById.mockResolvedValue(coupon);

      expect(await controller.findById('c1')).toEqual({
        success: true,
        data: coupon,
      });
      expect(mockService.findById).toHaveBeenCalledWith('c1');
    });
  });

  describe('create', () => {
    it('should delegate and wrap result', async () => {
      const dto = { code: 'NEW20', discountPercent: 20 } as any;
      const created = { id: 'c2', ...dto };
      mockService.create.mockResolvedValue(created);

      expect(await controller.create(dto)).toEqual({
        success: true,
        data: created,
      });
      expect(mockService.create).toHaveBeenCalledWith(dto);
    });
  });

  describe('update', () => {
    it('should delegate with id and dto', async () => {
      const dto = { discountPercent: 25 } as any;
      const updated = { id: 'c1', discountPercent: 25 };
      mockService.update.mockResolvedValue(updated);

      expect(await controller.update('c1', dto)).toEqual({
        success: true,
        data: updated,
      });
      expect(mockService.update).toHaveBeenCalledWith('c1', dto);
    });
  });

  describe('delete', () => {
    it('should delegate and wrap result', async () => {
      mockService.delete.mockResolvedValue({ id: 'c1' });

      expect(await controller.delete('c1')).toEqual({
        success: true,
        data: { id: 'c1' },
      });
      expect(mockService.delete).toHaveBeenCalledWith('c1');
    });
  });

  describe('applyCoupon', () => {
    it('should pass dto and user id from request', async () => {
      const dto = { code: 'SAVE10', bookingId: 'bk-1' } as any;
      const req = { user: { id: 'user-1' } };
      const applied = { discount: 10 };
      mockService.applyCoupon.mockResolvedValue(applied);

      const result = await controller.applyCoupon(dto, req);

      expect(result).toEqual({ success: true, data: applied });
      expect(mockService.applyCoupon).toHaveBeenCalledWith(dto, 'user-1');
    });
  });

  describe('validateCode', () => {
    it('should pass dto and user id from request', async () => {
      const dto = { code: 'SAVE10' } as any;
      const req = { user: { id: 'user-1' } };
      const validation = { valid: true, discount: 10 };
      mockService.validateCode.mockResolvedValue(validation);

      const result = await controller.validateCode(dto, req);

      expect(result).toEqual({ success: true, data: validation });
      expect(mockService.validateCode).toHaveBeenCalledWith(dto, 'user-1');
    });
  });
});
