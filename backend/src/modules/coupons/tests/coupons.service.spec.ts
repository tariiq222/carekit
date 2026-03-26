import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { CouponsService } from '../coupons.service.js';
import { PrismaService } from '../../../database/prisma.service.js';

const mockPrisma = {
  coupon: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  couponService: {
    deleteMany: jest.fn(),
    createMany: jest.fn(),
  },
  couponRedemption: {
    count: jest.fn(),
    create: jest.fn(),
  },
  $transaction: jest.fn((ops) => Promise.all(ops)),
};

const baseCoupon = {
  id: 'coupon-uuid-1',
  code: 'SAVE20',
  descriptionAr: 'خصم 20%',
  descriptionEn: '20% off',
  discountType: 'percentage',
  discountValue: 20,
  minAmount: 0,
  maxUses: null,
  usedCount: 0,
  maxUsesPerUser: null,
  expiresAt: null,
  isActive: true,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  couponServices: [],
};

describe('CouponsService', () => {
  let service: CouponsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CouponsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<CouponsService>(CouponsService);
    jest.clearAllMocks();
  });

  // ─────────────────────────────────────────────────────────────
  // findAll
  // ─────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('should return paginated items with meta', async () => {
      mockPrisma.coupon.findMany.mockResolvedValue([baseCoupon]);
      mockPrisma.coupon.count.mockResolvedValue(1);

      const result = await service.findAll({});

      expect(result.items).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });

    it('should return serviceIds array in each item', async () => {
      mockPrisma.coupon.findMany.mockResolvedValue([{
        ...baseCoupon,
        couponServices: [{ serviceId: 'svc-1' }],
      }]);
      mockPrisma.coupon.count.mockResolvedValue(1);

      const result = await service.findAll({});

      expect(result.items[0]).toHaveProperty('serviceIds', ['svc-1']);
    });

    it('should filter by active status', async () => {
      mockPrisma.coupon.findMany.mockResolvedValue([]);
      mockPrisma.coupon.count.mockResolvedValue(0);

      await service.findAll({ status: 'active' } as never);

      expect(mockPrisma.coupon.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isActive: true, OR: expect.any(Array) }),
        }),
      );
    });

    it('should filter by inactive status', async () => {
      mockPrisma.coupon.findMany.mockResolvedValue([]);
      mockPrisma.coupon.count.mockResolvedValue(0);

      await service.findAll({ status: 'inactive' } as never);

      expect(mockPrisma.coupon.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isActive: false }),
        }),
      );
    });

    it('should filter by expired status', async () => {
      mockPrisma.coupon.findMany.mockResolvedValue([]);
      mockPrisma.coupon.count.mockResolvedValue(0);

      await service.findAll({ status: 'expired' } as never);

      expect(mockPrisma.coupon.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ expiresAt: expect.objectContaining({ lte: expect.any(Date) }) }),
        }),
      );
    });
  });

  // ─────────────────────────────────────────────────────────────
  // update
  // ─────────────────────────────────────────────────────────────

  describe('update', () => {
    it('should update coupon and return shaped result', async () => {
      mockPrisma.coupon.findUnique.mockResolvedValue(baseCoupon);
      mockPrisma.coupon.update.mockResolvedValue({ ...baseCoupon, descriptionEn: 'Updated' });

      const result = await service.update(baseCoupon.id, { descriptionEn: 'Updated' } as never);

      expect(result).toHaveProperty('serviceIds');
      expect(mockPrisma.coupon.update).toHaveBeenCalled();
    });

    it('should throw NotFoundException when coupon not found', async () => {
      mockPrisma.coupon.findUnique.mockResolvedValue(null);

      await expect(service.update('missing-id', { descriptionEn: 'X' } as never)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should replace service restrictions when serviceIds provided', async () => {
      mockPrisma.coupon.findUnique.mockResolvedValue(baseCoupon);
      mockPrisma.coupon.update.mockResolvedValue(baseCoupon);

      await service.update(baseCoupon.id, { serviceIds: ['svc-1', 'svc-2'] } as never);

      expect(mockPrisma.couponService.deleteMany).toHaveBeenCalledWith({
        where: { couponId: baseCoupon.id },
      });
      expect(mockPrisma.couponService.createMany).toHaveBeenCalled();
    });

    it('should only delete (no createMany) when serviceIds is empty array', async () => {
      mockPrisma.coupon.findUnique.mockResolvedValue(baseCoupon);
      mockPrisma.coupon.update.mockResolvedValue(baseCoupon);

      await service.update(baseCoupon.id, { serviceIds: [] } as never);

      expect(mockPrisma.couponService.deleteMany).toHaveBeenCalled();
      expect(mockPrisma.couponService.createMany).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────────────
  // findById
  // ─────────────────────────────────────────────────────────────

  describe('findById', () => {
    it('should throw NotFoundException when coupon not found', async () => {
      mockPrisma.coupon.findUnique.mockResolvedValue(null);

      await expect(service.findById('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─────────────────────────────────────────────────────────────
  // create
  // ─────────────────────────────────────────────────────────────

  describe('create', () => {
    it('should uppercase the coupon code', async () => {
      mockPrisma.coupon.findUnique.mockResolvedValue(null);
      mockPrisma.coupon.create.mockResolvedValue({ ...baseCoupon, code: 'SAVE20' });

      await service.create({
        code: 'save20',
        discountType: 'percentage',
        discountValue: 20,
      } as never);

      expect(mockPrisma.coupon.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ code: 'SAVE20' }),
        }),
      );
    });

    it('should throw ConflictException when code already exists', async () => {
      mockPrisma.coupon.findUnique.mockResolvedValue(baseCoupon);

      await expect(
        service.create({
          code: 'SAVE20',
          discountType: 'percentage',
          discountValue: 20,
        } as never),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // delete
  // ─────────────────────────────────────────────────────────────

  describe('delete', () => {
    it('should delete coupon', async () => {
      mockPrisma.coupon.findUnique.mockResolvedValue(baseCoupon);
      mockPrisma.coupon.delete.mockResolvedValue(baseCoupon);

      const result = await service.delete(baseCoupon.id);

      expect(result).toEqual({ deleted: true });
      expect(mockPrisma.coupon.delete).toHaveBeenCalledWith({
        where: { id: baseCoupon.id },
      });
    });
  });

  // ─────────────────────────────────────────────────────────────
  // applyCoupon
  // ─────────────────────────────────────────────────────────────

  describe('applyCoupon', () => {
    const applyDto = { code: 'SAVE20', amount: 100 };
    const userId = 'user-uuid-1';

    it('should throw NotFoundException when coupon not found or inactive', async () => {
      mockPrisma.coupon.findFirst.mockResolvedValue(null);

      await expect(service.applyCoupon(applyDto as never, userId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException when coupon expired', async () => {
      mockPrisma.coupon.findFirst.mockResolvedValue({
        ...baseCoupon,
        expiresAt: new Date('2020-01-01'),
      });

      await expect(service.applyCoupon(applyDto as never, userId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when usage limit reached (maxUses=5, usedCount=5)', async () => {
      mockPrisma.coupon.findFirst.mockResolvedValue({
        ...baseCoupon,
        maxUses: 5,
        usedCount: 5,
      });

      await expect(service.applyCoupon(applyDto as never, userId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when per-user limit reached', async () => {
      mockPrisma.coupon.findFirst.mockResolvedValue({
        ...baseCoupon,
        maxUsesPerUser: 1,
      });
      mockPrisma.couponRedemption.count.mockResolvedValue(1);

      await expect(service.applyCoupon(applyDto as never, userId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when service not in restriction list', async () => {
      mockPrisma.coupon.findFirst.mockResolvedValue({
        ...baseCoupon,
        couponServices: [{ serviceId: 'service-a' }],
      });
      mockPrisma.couponRedemption.count.mockResolvedValue(0);

      await expect(
        service.applyCoupon(
          { code: 'SAVE20', amount: 100, serviceId: 'service-b' } as never,
          userId,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when amount below minAmount', async () => {
      mockPrisma.coupon.findFirst.mockResolvedValue({
        ...baseCoupon,
        minAmount: 200,
      });
      mockPrisma.couponRedemption.count.mockResolvedValue(0);

      await expect(
        service.applyCoupon({ code: 'SAVE20', amount: 100 } as never, userId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should return correct percentage discount (100 SAR * 20% = 20 SAR)', async () => {
      mockPrisma.coupon.findFirst.mockResolvedValue({
        ...baseCoupon,
        discountType: 'percentage',
        discountValue: 20,
      });
      mockPrisma.couponRedemption.count.mockResolvedValue(0);

      const result = await service.applyCoupon(
        { code: 'SAVE20', amount: 100 } as never,
        userId,
      );

      expect(result.discountAmount).toBe(20);
    });

    it('should return correct fixed discount (100 SAR - 15 fixed = 15 SAR)', async () => {
      mockPrisma.coupon.findFirst.mockResolvedValue({
        ...baseCoupon,
        discountType: 'fixed',
        discountValue: 15,
      });
      mockPrisma.couponRedemption.count.mockResolvedValue(0);

      const result = await service.applyCoupon(
        { code: 'SAVE20', amount: 100 } as never,
        userId,
      );

      expect(result.discountAmount).toBe(15);
    });

    it('should NOT apply service restriction when couponServices is empty', async () => {
      mockPrisma.coupon.findFirst.mockResolvedValue({
        ...baseCoupon,
        couponServices: [],
        discountType: 'fixed',
        discountValue: 10,
      });
      mockPrisma.couponRedemption.count.mockResolvedValue(0);

      const result = await service.applyCoupon(
        { code: 'SAVE20', amount: 100, serviceId: 'any-service' } as never,
        userId,
      );

      expect(result.discountAmount).toBe(10);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // redeemCoupon
  // ─────────────────────────────────────────────────────────────

  describe('redeemCoupon', () => {
    it('should create redemption record and increment usedCount', async () => {
      mockPrisma.$transaction.mockResolvedValue([{}, {}]);

      await service.redeemCoupon('coupon-1', 'user-1', 'booking-1', 100);

      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(mockPrisma.couponRedemption.create).toHaveBeenCalledWith({
        data: {
          couponId: 'coupon-1',
          userId: 'user-1',
          bookingId: 'booking-1',
          amount: 100,
        },
      });
      expect(mockPrisma.coupon.update).toHaveBeenCalledWith({
        where: { id: 'coupon-1' },
        data: { usedCount: { increment: 1 } },
      });
    });
  });
});
