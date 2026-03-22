/** CareKit — PatientsService Unit Tests */

import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PatientsService } from '../patients.service.js';
import { PrismaService } from '../../../database/prisma.service.js';

const mockPatient = {
  id: 'patient-1',
  firstName: 'أحمد',
  lastName: 'الراشد',
  email: 'ahmed@example.com',
  phone: '+966501234567',
  gender: 'male',
  createdAt: new Date('2026-01-15'),
  _count: { bookingsAsPatient: 5 },
};

const mockPrismaService: any = {
  user: {
    findMany: jest.fn(),
    count: jest.fn(),
    findFirst: jest.fn(),
  },
  booking: {
    groupBy: jest.fn(),
  },
  payment: {
    aggregate: jest.fn(),
  },
};

describe('PatientsService', () => {
  let service: PatientsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PatientsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();
    service = module.get<PatientsService>(PatientsService);
  });

  describe('findAll', () => {
    it('returns paginated data with default page=1 perPage=20', async () => {
      mockPrismaService.user.count.mockResolvedValue(3);
      mockPrismaService.user.findMany.mockResolvedValue([mockPatient]);

      const result = await service.findAll({});

      expect(result.meta.page).toBe(1);
      expect(result.meta.perPage).toBe(20);
      expect(result.data).toEqual([mockPatient]);
    });

    it('returns correct totalPages=3 when total=50 and perPage=20', async () => {
      mockPrismaService.user.count.mockResolvedValue(50);
      mockPrismaService.user.findMany.mockResolvedValue([]);

      const result = await service.findAll({ page: 1, perPage: 20 });

      expect(result.meta.total).toBe(50);
      expect(result.meta.totalPages).toBe(3);
    });

    it('applies skip=(page-1)*perPage: page=2 perPage=10 → skip=10', async () => {
      mockPrismaService.user.count.mockResolvedValue(30);
      mockPrismaService.user.findMany.mockResolvedValue([]);

      await service.findAll({ page: 2, perPage: 10 });

      expect(mockPrismaService.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 10 }),
      );
    });

    it('passes search filter with OR clause when search provided', async () => {
      mockPrismaService.user.count.mockResolvedValue(1);
      mockPrismaService.user.findMany.mockResolvedValue([mockPatient]);

      await service.findAll({ search: 'أحمد' });

      expect(mockPrismaService.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({ firstName: expect.anything() }),
              expect.objectContaining({ email: expect.anything() }),
              expect.objectContaining({ phone: expect.anything() }),
            ]),
          }),
        }),
      );
    });

    it('does NOT include OR clause when search is undefined', async () => {
      mockPrismaService.user.count.mockResolvedValue(1);
      mockPrismaService.user.findMany.mockResolvedValue([mockPatient]);

      await service.findAll({});

      const callArgs = mockPrismaService.user.findMany.mock.calls[0][0];
      expect(callArgs.where).not.toHaveProperty('OR');
    });

    it('returns empty array when no patients found', async () => {
      mockPrismaService.user.count.mockResolvedValue(0);
      mockPrismaService.user.findMany.mockResolvedValue([]);

      const result = await service.findAll({});

      expect(result.data).toEqual([]);
      expect(result.meta.total).toBe(0);
    });

    it('filters deletedAt=null in where clause', async () => {
      mockPrismaService.user.count.mockResolvedValue(0);
      mockPrismaService.user.findMany.mockResolvedValue([]);

      await service.findAll({});

      expect(mockPrismaService.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ deletedAt: null }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('returns patient with bookingsAsPatient', async () => {
      const patientWithBookings = { ...mockPatient, bookingsAsPatient: [] };
      mockPrismaService.user.findFirst.mockResolvedValue(patientWithBookings);

      const result = await service.findOne('patient-1');

      expect(result).toEqual(patientWithBookings);
    });

    it('throws NotFoundException when patient not found', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(null);

      await expect(service.findOne('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('queries with id AND deletedAt=null', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(mockPatient);

      await service.findOne('patient-1');

      expect(mockPrismaService.user.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: 'patient-1',
            deletedAt: null,
          }),
        }),
      );
    });
  });

  describe('getPatientStats', () => {
    it('throws NotFoundException when patient not found', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(null);

      await expect(service.getPatientStats('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns totalBookings as sum of all group counts', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(mockPatient);
      mockPrismaService.booking.groupBy.mockResolvedValue([
        { status: 'confirmed', _count: { _all: 3 } },
        { status: 'completed', _count: { _all: 2 } },
      ]);
      mockPrismaService.payment.aggregate.mockResolvedValue({
        _sum: { totalAmount: 500 },
        _count: { id: 2 },
      });

      const result = await service.getPatientStats('patient-1');

      expect(result.totalBookings).toBe(5);
    });

    it('returns byStatus as Record<status, count>', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(mockPatient);
      mockPrismaService.booking.groupBy.mockResolvedValue([
        { status: 'confirmed', _count: { _all: 3 } },
        { status: 'completed', _count: { _all: 2 } },
      ]);
      mockPrismaService.payment.aggregate.mockResolvedValue({
        _sum: { totalAmount: 0 },
        _count: { id: 0 },
      });

      const result = await service.getPatientStats('patient-1');

      expect(result.byStatus).toEqual({ confirmed: 3, completed: 2 });
    });

    it('returns totalPaid from payment aggregate._sum.totalAmount', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(mockPatient);
      mockPrismaService.booking.groupBy.mockResolvedValue([]);
      mockPrismaService.payment.aggregate.mockResolvedValue({
        _sum: { totalAmount: 1500 },
        _count: { id: 3 },
      });

      const result = await service.getPatientStats('patient-1');

      expect(result.totalPaid).toBe(1500);
    });

    it('returns completedPayments from payment aggregate._count.id', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(mockPatient);
      mockPrismaService.booking.groupBy.mockResolvedValue([]);
      mockPrismaService.payment.aggregate.mockResolvedValue({
        _sum: { totalAmount: 1000 },
        _count: { id: 4 },
      });

      const result = await service.getPatientStats('patient-1');

      expect(result.completedPayments).toBe(4);
    });

    it('returns totalPaid=0 when _sum.totalAmount is null', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(mockPatient);
      mockPrismaService.booking.groupBy.mockResolvedValue([]);
      mockPrismaService.payment.aggregate.mockResolvedValue({
        _sum: { totalAmount: null },
        _count: { id: 0 },
      });

      const result = await service.getPatientStats('patient-1');

      expect(result.totalPaid).toBe(0);
    });
  });
});
