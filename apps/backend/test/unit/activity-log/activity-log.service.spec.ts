import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ActivityLogService } from '../../../src/modules/activity-log/activity-log.service.js';
import { PrismaService } from '../../../src/database/prisma.service.js';

const mockPrisma = {
  activityLog: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    count: jest.fn(),
  },
};

describe('ActivityLogService', () => {
  let service: ActivityLogService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ActivityLogService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<ActivityLogService>(ActivityLogService);
  });

  // ─────────────────────────────────────────────────────────────
  //  log
  // ─────────────────────────────────────────────────────────────

  describe('log', () => {
    it('should create activity log record', async () => {
      mockPrisma.activityLog.create.mockResolvedValue({ id: 'log-1' });

      await service.log({
        action: 'CREATE',
        module: 'patients',
        userId: 'u-1',
      });

      expect(mockPrisma.activityLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'CREATE',
          module: 'patients',
          userId: 'u-1',
        }),
      });
    });

    it('should NOT throw when prisma.create fails (silent error)', async () => {
      mockPrisma.activityLog.create.mockRejectedValue(new Error('DB down'));

      await expect(
        service.log({ action: 'DELETE', module: 'bookings' }),
      ).resolves.toBeUndefined();
    });
  });

  // ─────────────────────────────────────────────────────────────
  //  findAll
  // ─────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('should return paginated results with meta', async () => {
      const fakeItems = [{ id: 'log-1', action: 'CREATE', module: 'patients' }];
      mockPrisma.activityLog.findMany.mockResolvedValue(fakeItems);
      mockPrisma.activityLog.count.mockResolvedValue(1);

      const result = await service.findAll({ page: 1, perPage: 10 });

      expect(result.success).toBe(true);
      expect(result.data.items).toEqual(fakeItems);
      expect(result.data.meta).toMatchObject({
        total: 1,
        page: 1,
        perPage: 10,
      });
    });

    it('should apply module filter when provided', async () => {
      mockPrisma.activityLog.findMany.mockResolvedValue([]);
      mockPrisma.activityLog.count.mockResolvedValue(0);

      await service.findAll({ module: 'payments' });

      const call = mockPrisma.activityLog.findMany.mock.calls[0][0];
      expect(call.where).toMatchObject({ module: 'payments' });
    });

    it('should apply dateFrom/dateTo filters', async () => {
      mockPrisma.activityLog.findMany.mockResolvedValue([]);
      mockPrisma.activityLog.count.mockResolvedValue(0);

      await service.findAll({ dateFrom: '2024-01-01', dateTo: '2024-12-31' });

      const call = mockPrisma.activityLog.findMany.mock.calls[0][0];
      expect(call.where.createdAt).toMatchObject({
        gte: new Date('2024-01-01'),
        lte: new Date('2024-12-31'),
      });
    });

    it('should use default page=1, perPage=20 when not provided', async () => {
      mockPrisma.activityLog.findMany.mockResolvedValue([]);
      mockPrisma.activityLog.count.mockResolvedValue(0);

      const result = await service.findAll({});

      const call = mockPrisma.activityLog.findMany.mock.calls[0][0];
      expect(call.skip).toBe(0);
      expect(call.take).toBe(20);
      expect(result.data.meta).toMatchObject({ page: 1, perPage: 20 });
    });
  });

  // ─────────────────────────────────────────────────────────────
  //  findOne
  // ─────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('should return log wrapped in {success: true, data}', async () => {
      const fakeLog = { id: 'log-1', action: 'CREATE', module: 'patients' };
      mockPrisma.activityLog.findUnique.mockResolvedValue(fakeLog);

      const result = await service.findOne('log-1');

      expect(result).toEqual({ success: true, data: fakeLog });
    });

    it('should throw NotFoundException when log not found', async () => {
      mockPrisma.activityLog.findUnique.mockResolvedValue(null);

      await expect(service.findOne('missing-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
