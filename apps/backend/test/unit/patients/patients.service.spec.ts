/** CareKit — PatientsService Unit Tests */

import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { PatientsService } from '../../../src/modules/patients/patients.service.js';
import { PrismaService } from '../../../src/database/prisma.service.js';
import { ActivityLogService } from '../../../src/modules/activity-log/activity-log.service.js';

const mockPatient = {
  id: 'patient-1',
  firstName: 'أحمد',
  lastName: 'الراشد',
  email: 'ahmed@example.com',
  phone: '+966501234567',
  gender: 'male',
  isActive: true,
  avatarUrl: null,
  accountType: 'full',
  claimedAt: null,
  createdAt: new Date('2026-01-15'),
  bookingsAsPatient: [],
};

const mockPrismaService: any = {
  user: {
    findMany: jest.fn(),
    count: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  patientProfile: {
    upsert: jest.fn(),
  },
  booking: {
    findMany: jest.fn(),
    groupBy: jest.fn(),
    count: jest.fn(),
  },
  payment: {
    aggregate: jest.fn(),
  },

  $transaction: jest.fn(
    (opsOrFn: Promise<unknown>[] | ((tx: any) => Promise<unknown>)) => {
      if (typeof opsOrFn === 'function') return opsOrFn(mockPrismaService);
      return Promise.all(opsOrFn);
    },
  ),
};

const mockActivityLogService: any = {
  log: jest.fn().mockResolvedValue(undefined),
};

describe('PatientsService', () => {
  let service: PatientsService;
  let activityLogService: any;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PatientsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: ActivityLogService, useValue: mockActivityLogService },
      ],
    }).compile();
    service = module.get<PatientsService>(PatientsService);
    activityLogService = module.get<ActivityLogService>(ActivityLogService);
  });

  // ────────────────────────────────────────────
  describe('findAll', () => {
    beforeEach(() => {
      // Upcoming bookings query — empty by default
      mockPrismaService.booking.findMany.mockResolvedValue([]);
    });

    it('returns paginated data with default page=1 perPage=20', async () => {
      mockPrismaService.user.count.mockResolvedValue(3);
      mockPrismaService.user.findMany.mockResolvedValue([mockPatient]);

      const result = await service.findAll({});

      expect(result.meta.page).toBe(1);
      expect(result.meta.perPage).toBe(20);
      expect(result.items).toHaveLength(1);
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

    it('returns empty items when no patients found', async () => {
      mockPrismaService.user.count.mockResolvedValue(0);
      mockPrismaService.user.findMany.mockResolvedValue([]);

      const result = await service.findAll({});

      expect(result.items).toEqual([]);
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

    it('applies isActive filter when provided', async () => {
      mockPrismaService.user.count.mockResolvedValue(2);
      mockPrismaService.user.findMany.mockResolvedValue([]);

      await service.findAll({ isActive: false });

      expect(mockPrismaService.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isActive: false }),
        }),
      );
    });

    it('does NOT include isActive filter when not provided', async () => {
      mockPrismaService.user.count.mockResolvedValue(1);
      mockPrismaService.user.findMany.mockResolvedValue([mockPatient]);

      await service.findAll({});

      const callArgs = mockPrismaService.user.findMany.mock.calls[0][0];
      expect(callArgs.where).not.toHaveProperty('isActive');
    });

    it('sets lastBooking=null when patient has no bookings', async () => {
      const patientNoBookings = { ...mockPatient, bookingsAsPatient: [] };
      mockPrismaService.user.count.mockResolvedValue(1);
      mockPrismaService.user.findMany.mockResolvedValue([patientNoBookings]);

      const result = await service.findAll({});

      expect(result.items[0].lastBooking).toBeNull();
    });

    it('maps lastBooking from bookingsAsPatient[0]', async () => {
      const lastBooking = {
        id: 'booking-1',
        date: new Date('2026-03-01'),
        status: 'completed',
      };
      const patientWithBooking = {
        ...mockPatient,
        bookingsAsPatient: [lastBooking],
      };
      mockPrismaService.user.count.mockResolvedValue(1);
      mockPrismaService.user.findMany.mockResolvedValue([patientWithBooking]);

      const result = await service.findAll({});

      expect(result.items[0].lastBooking).toEqual(lastBooking);
    });

    it('maps nextBooking from upcomingBookings when available', async () => {
      const upcomingBooking = {
        patientId: 'patient-1',
        id: 'booking-2',
        date: new Date('2026-04-01'),
        status: 'confirmed',
      };
      mockPrismaService.user.count.mockResolvedValue(1);
      mockPrismaService.user.findMany.mockResolvedValue([mockPatient]);
      mockPrismaService.booking.findMany.mockResolvedValue([upcomingBooking]);

      const result = await service.findAll({});

      expect(result.items[0].nextBooking).toEqual(upcomingBooking);
    });

    it('sets nextBooking=null when no upcoming bookings', async () => {
      mockPrismaService.user.count.mockResolvedValue(1);
      mockPrismaService.user.findMany.mockResolvedValue([mockPatient]);
      mockPrismaService.booking.findMany.mockResolvedValue([]);

      const result = await service.findAll({});

      expect(result.items[0].nextBooking).toBeNull();
    });

    it('filters upcoming bookings by patientId list', async () => {
      mockPrismaService.user.count.mockResolvedValue(1);
      mockPrismaService.user.findMany.mockResolvedValue([mockPatient]);

      await service.findAll({});

      expect(mockPrismaService.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            patientId: { in: ['patient-1'] },
          }),
        }),
      );
    });
  });

  // ────────────────────────────────────────────
  describe('updatePatient', () => {
    const updatedUser = {
      id: 'patient-1',
      firstName: 'محمد',
      middleName: null,
      lastName: 'الراشد',
      email: 'ahmed@example.com',
      phone: '+966501234567',
      gender: 'male',
      isActive: true,
      updatedAt: new Date('2026-03-01'),
    };

    it('should update patient and return updated user', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue({ id: 'patient-1' });
      mockPrismaService.user.update.mockResolvedValue(updatedUser);

      const result = await service.updatePatient('patient-1', {
        firstName: 'محمد',
      } as never);

      expect(result).toEqual(updatedUser);
      expect(mockPrismaService.$transaction).toHaveBeenCalled();
    });

    it('should throw NotFoundException when patient not found', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(null);

      await expect(
        service.updatePatient('missing-id', { firstName: 'Test' } as never),
      ).rejects.toThrow(NotFoundException);
    });

    it('should include patientProfile upsert when profile fields provided', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue({ id: 'patient-1' });
      mockPrismaService.user.update.mockResolvedValue(updatedUser);
      mockPrismaService.patientProfile.upsert.mockResolvedValue({});

      await service.updatePatient('patient-1', { nationality: 'SA' } as never);

      expect(mockPrismaService.patientProfile.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'patient-1' },
          update: expect.objectContaining({ nationality: 'SA' }),
          create: expect.objectContaining({
            userId: 'patient-1',
            nationality: 'SA',
          }),
        }),
      );
    });

    it('should not call patientProfile upsert when no profile fields provided', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue({ id: 'patient-1' });
      mockPrismaService.user.update.mockResolvedValue(updatedUser);

      await service.updatePatient('patient-1', { firstName: 'Test' } as never);

      expect(mockPrismaService.patientProfile.upsert).not.toHaveBeenCalled();
    });

    it('converts dateOfBirth string to Date object', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue({ id: 'patient-1' });
      mockPrismaService.user.update.mockResolvedValue(updatedUser);
      mockPrismaService.patientProfile.upsert.mockResolvedValue({});

      await service.updatePatient('patient-1', {
        dateOfBirth: '1990-05-15',
      } as never);

      expect(mockPrismaService.patientProfile.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({
            dateOfBirth: new Date('1990-05-15'),
          }),
        }),
      );
    });

    it('queries with id AND deletedAt=null AND patient role before updating', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue({
        id: 'patient-1',
        phone: '+966501234567',
      });
      mockPrismaService.user.update.mockResolvedValue(updatedUser);

      await service.updatePatient('patient-1', { firstName: 'Test' } as never);

      expect(mockPrismaService.user.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: 'patient-1',
            deletedAt: null,
            userRoles: { some: { role: { slug: 'patient' } } },
          }),
        }),
      );
    });
  });

  // ────────────────────────────────────────────
  describe('updatePatient phone conflict + role guard + audit', () => {
    it('should throw ConflictException when phone is already taken', async () => {
      const patientId = 'patient-uuid-1';
      const existingPhone = '+966501234567';

      mockPrismaService.user.findFirst
        .mockResolvedValueOnce({ id: patientId })
        .mockResolvedValueOnce({ id: 'other-user-uuid' });

      await expect(
        service.updatePatient(patientId, { phone: existingPhone } as never),
      ).rejects.toThrow(ConflictException);
    });

    it('should require patient role in findFirst', async () => {
      mockPrismaService.user.findFirst.mockResolvedValueOnce(null);

      await expect(
        service.updatePatient('admin-uuid-1', { firstName: 'Test' } as never),
      ).rejects.toThrow(NotFoundException);
    });

    it('should call activityLog.log after successful update', async () => {
      const updatedResult = { id: 'patient-1', firstName: 'Ahmad' };
      mockPrismaService.user.findFirst.mockResolvedValueOnce({
        id: 'patient-1',
        phone: '+966501234567',
      });
      mockPrismaService.user.update.mockResolvedValueOnce(updatedResult);

      const logSpy = jest
        .spyOn(activityLogService, 'log')
        .mockResolvedValue(undefined);

      await service.updatePatient('patient-1', { firstName: 'Ahmad' } as never);

      expect(logSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'updated',
          module: 'patients',
          resourceId: 'patient-1',
        }),
      );
    });
  });

  // ────────────────────────────────────────────
  describe('findOne', () => {
    beforeEach(() => {
      mockPrismaService.user.findFirst.mockReset();
    });

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

      expect(mockPrismaService.user.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userRoles: { some: { role: { slug: 'patient' } } },
          }),
        }),
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

    it('includes patientProfile in select', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue({
        ...mockPatient,
        patientProfile: {
          nationalId: '1234',
          nationality: 'SA',
          dateOfBirth: null,
          emergencyName: null,
          emergencyPhone: null,
          bloodType: null,
          allergies: null,
          chronicConditions: null,
        },
      });

      const result = await service.findOne('patient-1');

      expect(result).toHaveProperty('patientProfile');
    });
  });

  // ────────────────────────────────────────────
  describe('getPatientBookings', () => {
    it('throws NotFoundException when patient not found', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(null);

      await expect(service.getPatientBookings('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('[IDOR] throws NotFoundException when ID belongs to a non-patient user', async () => {
      // Simulate a staff user ID — findFirst with patient role guard returns null
      mockPrismaService.user.findFirst.mockResolvedValue(null);

      await expect(
        service.getPatientBookings('staff-user-uuid'),
      ).rejects.toThrow(NotFoundException);

      expect(mockPrismaService.user.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userRoles: { some: { role: { slug: 'patient' } } },
          }),
        }),
      );
    });

    it('returns bookings ordered by date desc', async () => {
      const mockBookings = [
        { id: 'b-2', date: new Date('2026-03-20'), status: 'completed' },
        { id: 'b-1', date: new Date('2026-03-01'), status: 'completed' },
      ];
      mockPrismaService.user.findFirst.mockResolvedValue({ id: 'patient-1' });
      mockPrismaService.booking.count.mockResolvedValue(2);
      mockPrismaService.booking.findMany.mockResolvedValue(mockBookings);

      const result = await service.getPatientBookings('patient-1');

      expect(result.items).toEqual(mockBookings);
      expect(result.meta.total).toBe(2);
      expect(mockPrismaService.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { date: 'desc' },
        }),
      );
    });

    it('filters deletedAt=null for bookings', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue({ id: 'patient-1' });
      mockPrismaService.booking.count.mockResolvedValue(0);
      mockPrismaService.booking.findMany.mockResolvedValue([]);

      await service.getPatientBookings('patient-1');

      expect(mockPrismaService.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            patientId: 'patient-1',
            deletedAt: null,
          }),
        }),
      );
    });

    it('returns empty array when patient has no bookings', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue({ id: 'patient-1' });
      mockPrismaService.booking.count.mockResolvedValue(0);
      mockPrismaService.booking.findMany.mockResolvedValue([]);

      const result = await service.getPatientBookings('patient-1');

      expect(result.items).toEqual([]);
      expect(result.meta.total).toBe(0);
    });
  });

  // ────────────────────────────────────────────
  describe('getPatientStats', () => {
    it('throws NotFoundException when patient not found', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(null);

      await expect(service.getPatientStats('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('[IDOR] throws NotFoundException when ID belongs to a non-patient user', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(null);

      await expect(service.getPatientStats('admin-user-uuid')).rejects.toThrow(
        NotFoundException,
      );

      expect(mockPrismaService.user.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userRoles: { some: { role: { slug: 'patient' } } },
          }),
        }),
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

    it('returns totalBookings=0 and empty byStatus when no bookings', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(mockPatient);
      mockPrismaService.booking.groupBy.mockResolvedValue([]);
      mockPrismaService.payment.aggregate.mockResolvedValue({
        _sum: { totalAmount: null },
        _count: { id: 0 },
      });

      const result = await service.getPatientStats('patient-1');

      expect(result.totalBookings).toBe(0);
      expect(result.byStatus).toEqual({});
    });

    it('filters bookings by patientId and deletedAt=null in groupBy', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(mockPatient);
      mockPrismaService.booking.groupBy.mockResolvedValue([]);
      mockPrismaService.payment.aggregate.mockResolvedValue({
        _sum: { totalAmount: null },
        _count: { id: 0 },
      });

      await service.getPatientStats('patient-1');

      expect(mockPrismaService.booking.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            patientId: 'patient-1',
            deletedAt: null,
          }),
        }),
      );
    });

    it('aggregates only paid payments', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(mockPatient);
      mockPrismaService.booking.groupBy.mockResolvedValue([]);
      mockPrismaService.payment.aggregate.mockResolvedValue({
        _sum: { totalAmount: null },
        _count: { id: 0 },
      });

      await service.getPatientStats('patient-1');

      expect(mockPrismaService.payment.aggregate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'paid' }),
        }),
      );
    });
  });

  // ─── Hard edge cases ───────────────────────────────────────────────────────

  describe('[TOCTOU] updatePatient phone uniqueness race condition', () => {
    it('maps P2002 from concurrent phone update to ConflictException', async () => {
      mockPrismaService.user.findFirst.mockResolvedValueOnce({
        id: 'patient-1',
        phone: '+966501234567',
      });

      const p2002 = Object.assign(
        new Error('Unique constraint failed on the fields: (`phone`)'),
        {
          code: 'P2002',
          meta: { target: ['phone'] },
        },
      );
      // Simulate DB constraint firing even after the in-transaction check passed
      mockPrismaService.$transaction.mockRejectedValueOnce(p2002);

      await expect(
        service.updatePatient('patient-1', { phone: '+966509999999' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('[perPage cap] getPatientBookings enforces parsePaginationParams maxPerPage=100', () => {
    it('caps perPage at 100 even when a larger value is requested', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue({ id: 'patient-1' });
      mockPrismaService.booking.count.mockResolvedValue(0);
      mockPrismaService.booking.findMany.mockResolvedValue([]);

      await expect(
        service.getPatientBookings('patient-1', { perPage: 10000 }),
      ).resolves.not.toThrow();

      // parsePaginationParams enforces maxPerPage=100 — 10000 is clamped to 100
      expect(mockPrismaService.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 100 }),
      );
    });
  });
});
