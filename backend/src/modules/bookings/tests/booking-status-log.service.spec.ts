/**
 * BookingStatusLogService Unit Tests
 */
import { Test, TestingModule } from '@nestjs/testing';
import { BookingStatusLogService } from '../booking-status-log.service.js';
import { PrismaService } from '../../../database/prisma.service.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma: any = {
  bookingStatusLog: {
    create: jest.fn().mockResolvedValue({}),
    findMany: jest.fn(),
  },
};

describe('BookingStatusLogService', () => {
  let service: BookingStatusLogService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingStatusLogService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<BookingStatusLogService>(BookingStatusLogService);
    jest.clearAllMocks();
  });

  describe('log', () => {
    it('should create a status log entry with all fields', async () => {
      mockPrisma.bookingStatusLog.create.mockResolvedValue({});

      await service.log({
        bookingId: 'booking-uuid',
        fromStatus: 'pending',
        toStatus: 'confirmed',
        changedBy: 'user-uuid',
        reason: 'Payment received',
      });

      expect(mockPrisma.bookingStatusLog.create).toHaveBeenCalledWith({
        data: {
          bookingId: 'booking-uuid',
          fromStatus: 'pending',
          toStatus: 'confirmed',
          changedBy: 'user-uuid',
          reason: 'Payment received',
        },
      });
    });

    it('should create a log with only required fields', async () => {
      mockPrisma.bookingStatusLog.create.mockResolvedValue({});

      await service.log({
        bookingId: 'booking-uuid',
        toStatus: 'cancelled',
      });

      expect(mockPrisma.bookingStatusLog.create).toHaveBeenCalledWith({
        data: {
          bookingId: 'booking-uuid',
          fromStatus: undefined,
          toStatus: 'cancelled',
          changedBy: undefined,
          reason: undefined,
        },
      });
    });

    it('should return void (undefined)', async () => {
      mockPrisma.bookingStatusLog.create.mockResolvedValue({});
      const result = await service.log({ bookingId: 'x', toStatus: 'done' });
      expect(result).toBeUndefined();
    });
  });

  describe('findByBooking', () => {
    it('should return logs ordered by createdAt asc', async () => {
      const logs = [
        { id: '1', bookingId: 'booking-uuid', toStatus: 'confirmed', createdAt: new Date('2026-01-01') },
        { id: '2', bookingId: 'booking-uuid', toStatus: 'cancelled', createdAt: new Date('2026-01-02') },
      ];
      mockPrisma.bookingStatusLog.findMany.mockResolvedValue(logs);

      const result = await service.findByBooking('booking-uuid');

      expect(result).toHaveLength(2);
      expect(mockPrisma.bookingStatusLog.findMany).toHaveBeenCalledWith({
        where: { bookingId: 'booking-uuid' },
        orderBy: { createdAt: 'asc' },
      });
    });

    it('should return empty array when no logs exist', async () => {
      mockPrisma.bookingStatusLog.findMany.mockResolvedValue([]);
      const result = await service.findByBooking('missing-booking');
      expect(result).toEqual([]);
    });
  });
});
