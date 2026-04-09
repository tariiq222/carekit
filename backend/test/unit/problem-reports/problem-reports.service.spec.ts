import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ProblemReportsService } from '../../../src/modules/problem-reports/problem-reports.service.js';
import { PrismaService } from '../../../src/database/prisma.service.js';
import { NotificationsService } from '../../../src/modules/notifications/notifications.service.js';

const mockPrisma = {
  booking: { findFirst: jest.fn() },
  problemReport: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  userRole: { findMany: jest.fn() },
};

const mockNotifications = {
  createNotification: jest.fn().mockResolvedValue(undefined),
};

const completedBooking = {
  id: 'booking-1',
  status: 'completed',
  date: new Date('2024-06-01'),
  practitionerId: 'prac-1',
};

const createDto = {
  bookingId: 'booking-1',
  patientId: 'patient-1',
  type: 'service_quality',
  description: 'Poor service quality.',
};

describe('ProblemReportsService', () => {
  let service: ProblemReportsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProblemReportsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: NotificationsService, useValue: mockNotifications },
      ],
    }).compile();

    service = module.get<ProblemReportsService>(ProblemReportsService);
  });

  // ─────────────────────────────────────────────────────────────
  //  create
  // ─────────────────────────────────────────────────────────────

  describe('create', () => {
    it('should create report for completed booking', async () => {
      const fakeReport = { id: 'report-1', ...createDto, status: 'open' };
      mockPrisma.booking.findFirst.mockResolvedValue(completedBooking);
      mockPrisma.problemReport.create.mockResolvedValue(fakeReport);
      mockPrisma.userRole.findMany.mockResolvedValue([]);

      const result = await service.create(createDto);

      expect(mockPrisma.problemReport.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            bookingId: 'booking-1',
            patientId: 'patient-1',
            status: 'open',
          }),
        }),
      );
      expect(result).toEqual(fakeReport);
    });

    it('should throw NotFoundException when booking not found', async () => {
      mockPrisma.booking.findFirst.mockResolvedValue(null);

      await expect(service.create(createDto)).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when booking status is not completed', async () => {
      mockPrisma.booking.findFirst.mockResolvedValue({
        ...completedBooking,
        status: 'pending',
      });

      await expect(service.create(createDto)).rejects.toThrow(BadRequestException);
    });

    it('should notify admin users after creating report', async () => {
      const fakeReport = { id: 'report-1', ...createDto, status: 'open' };
      mockPrisma.booking.findFirst.mockResolvedValue(completedBooking);
      mockPrisma.problemReport.create.mockResolvedValue(fakeReport);
      mockPrisma.userRole.findMany.mockResolvedValue([
        { userId: 'admin-1' },
        { userId: 'admin-2' },
      ]);

      await service.create(createDto);

      expect(mockNotifications.createNotification).toHaveBeenCalledTimes(2);
      expect(mockNotifications.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'admin-1', type: 'problem_report' }),
      );
      expect(mockNotifications.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'admin-2', type: 'problem_report' }),
      );
    });
  });

  // ─────────────────────────────────────────────────────────────
  //  findOne
  // ─────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('should return problem report', async () => {
      const fakeReport = { id: 'report-1', status: 'open' };
      mockPrisma.problemReport.findUnique.mockResolvedValue(fakeReport);

      const result = await service.findOne('report-1');

      expect(result).toEqual(fakeReport);
    });

    it('should throw NotFoundException when report not found', async () => {
      mockPrisma.problemReport.findUnique.mockResolvedValue(null);

      await expect(service.findOne('missing-id')).rejects.toThrow(NotFoundException);
    });
  });

  // ─────────────────────────────────────────────────────────────
  //  resolve
  // ─────────────────────────────────────────────────────────────

  describe('resolve', () => {
    it('should update report status and set resolvedAt', async () => {
      const openReport = { id: 'report-1', status: 'open' };
      const resolvedReport = { id: 'report-1', status: 'resolved', resolvedAt: new Date() };
      mockPrisma.problemReport.findUnique.mockResolvedValue(openReport);
      mockPrisma.problemReport.update.mockResolvedValue(resolvedReport);

      const result = await service.resolve('report-1', 'admin-1', {
        status: 'resolved',
        adminNotes: 'Issue addressed.',
      });

      expect(mockPrisma.problemReport.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'report-1' },
          data: expect.objectContaining({
            status: 'resolved',
            resolvedById: 'admin-1',
          }),
        }),
      );
      expect(result).toEqual(resolvedReport);
    });

    it('should throw NotFoundException when report not found', async () => {
      mockPrisma.problemReport.findUnique.mockResolvedValue(null);

      await expect(
        service.resolve('missing-id', 'admin-1', { status: 'resolved' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when report already resolved', async () => {
      mockPrisma.problemReport.findUnique.mockResolvedValue({
        id: 'report-1',
        status: 'resolved',
      });

      await expect(
        service.resolve('report-1', 'admin-1', { status: 'dismissed' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when report already dismissed', async () => {
      mockPrisma.problemReport.findUnique.mockResolvedValue({
        id: 'report-1',
        status: 'dismissed',
      });

      await expect(
        service.resolve('report-1', 'admin-1', { status: 'resolved' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─────────────────────────────────────────────────────────────
  //  findAll
  // ─────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('should return paginated problem reports with correct meta', async () => {
      const reports = [{ id: 'report-1', status: 'open' }];
      mockPrisma.problemReport.findMany.mockResolvedValue(reports);
      mockPrisma.problemReport.count.mockResolvedValue(1);

      const result = await service.findAll({ page: 1, perPage: 10 });

      expect(result.items).toEqual(reports);
      expect(result.meta).toMatchObject({ total: 1, page: 1, perPage: 10 });
    });

    it('should filter by status when provided', async () => {
      mockPrisma.problemReport.findMany.mockResolvedValue([]);
      mockPrisma.problemReport.count.mockResolvedValue(0);

      await service.findAll({ status: 'resolved' });

      expect(mockPrisma.problemReport.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'resolved' }),
        }),
      );
    });

    it('should filter by patientId when provided', async () => {
      mockPrisma.problemReport.findMany.mockResolvedValue([]);
      mockPrisma.problemReport.count.mockResolvedValue(0);

      await service.findAll({ patientId: 'patient-1' });

      expect(mockPrisma.problemReport.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ patientId: 'patient-1' }),
        }),
      );
    });

    it('should apply no filters and return all reports when query is empty', async () => {
      mockPrisma.problemReport.findMany.mockResolvedValue([]);
      mockPrisma.problemReport.count.mockResolvedValue(0);

      await service.findAll({});

      expect(mockPrisma.problemReport.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: {} }),
      );
    });

    it('should order results by createdAt desc', async () => {
      mockPrisma.problemReport.findMany.mockResolvedValue([]);
      mockPrisma.problemReport.count.mockResolvedValue(0);

      await service.findAll({});

      expect(mockPrisma.problemReport.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { createdAt: 'desc' } }),
      );
    });

    it('should calculate correct skip for page 2 with perPage 5', async () => {
      mockPrisma.problemReport.findMany.mockResolvedValue([]);
      mockPrisma.problemReport.count.mockResolvedValue(12);

      const result = await service.findAll({ page: 2, perPage: 5 });

      expect(mockPrisma.problemReport.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 5, take: 5 }),
      );
      expect(result.meta).toMatchObject({ total: 12, page: 2, perPage: 5, totalPages: 3 });
    });
  });
});
