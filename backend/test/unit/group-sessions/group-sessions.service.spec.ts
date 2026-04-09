/**
 * GroupSessionsService — Unit Tests
 * Covers: create, findAll, findOne, update, remove, cancel, complete
 */
import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { GroupSessionsService } from '../../../src/modules/group-sessions/group-sessions.service.js';
import { PrismaService } from '../../../src/database/prisma.service.js';
import { NotificationsService } from '../../../src/modules/notifications/notifications.service.js';

const mockNotificationsService = {
  createNotification: jest.fn().mockResolvedValue({ id: 'notif-1' }),
};

const mockPrisma = {
  groupSession: {
    create: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  groupEnrollment: {
    updateMany: jest.fn(),
    findMany: jest.fn(),
  },
  $transaction: jest.fn((fn) => {
    if (typeof fn === 'function') {
      return fn({
        groupSession: mockPrisma.groupSession,
        groupEnrollment: mockPrisma.groupEnrollment,
      });
    }
    return Promise.all(fn);
  }),
};

const futureDate = (daysFromNow: number) => {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString();
};

const baseSession = {
  id: 'session-uuid-1',
  nameAr: 'جلسة علاج جماععي',
  nameEn: 'Group Therapy Session',
  descriptionAr: 'وصف الجلسة',
  descriptionEn: 'Session description',
  practitionerId: 'practitioner-uuid-1',
  departmentId: 'dept-uuid-1',
  minParticipants: 3,
  maxParticipants: 10,
  pricePerPersonHalalat: 100,
  durationMinutes: 60,
  paymentDeadlineHours: 48,
  schedulingMode: 'fixed_date' as const,
  status: 'open' as const,
  currentEnrollment: 0,
  isPublished: false,
  reminderSent: false,
  startTime: new Date(futureDate(7)),
  endTime: new Date(new Date(futureDate(7)).getTime() + 60 * 60 * 1000),
  expiresAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  practitioner: { id: 'practitioner-uuid-1', nameAr: 'د. أحمد' },
  enrollments: [],
};

const baseCreateDto = {
  nameAr: 'جلسة علاج جماععي',
  nameEn: 'Group Therapy Session',
  descriptionAr: 'وصف الجلسة',
  descriptionEn: 'Session description',
  practitionerId: 'practitioner-uuid-1',
  departmentId: 'dept-uuid-1',
  minParticipants: 3,
  maxParticipants: 10,
  pricePerPersonHalalat: 100,
  durationMinutes: 60,
  schedulingMode: 'fixed_date' as const,
  startTime: futureDate(7),
};

describe('GroupSessionsService', () => {
  let service: GroupSessionsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GroupSessionsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: NotificationsService, useValue: mockNotificationsService },
      ],
    }).compile();

    service = module.get<GroupSessionsService>(GroupSessionsService);
    jest.resetAllMocks();
    mockNotificationsService.createNotification.mockResolvedValue({ id: 'notif-1' });
    mockPrisma.$transaction.mockImplementation((fn: any) => {
      if (typeof fn === 'function') {
        return fn({
          groupSession: mockPrisma.groupSession,
          groupEnrollment: mockPrisma.groupEnrollment,
        });
      }
      return Promise.all(fn);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // CREATE
  // ─────────────────────────────────────────────────────────────

  describe('create', () => {
    it('should create a fixed_date group session with correct data', async () => {
      mockPrisma.groupSession.create.mockResolvedValue(baseSession);

      const result = await service.create(baseCreateDto);

      expect(result).toEqual(baseSession);
      expect(mockPrisma.groupSession.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            nameAr: 'جلسة علاج جماععي',
            nameEn: 'Group Therapy Session',
            schedulingMode: 'fixed_date',
            practitionerId: 'practitioner-uuid-1',
            minParticipants: 3,
            maxParticipants: 10,
            pricePerPersonHalalat: 100,
            durationMinutes: 60,
            paymentDeadlineHours: 48,
          }),
        }),
      );
    });

    it('should auto-calculate endTime from startTime + durationMinutes', async () => {
      mockPrisma.groupSession.create.mockResolvedValue(baseSession);
      const startTime = futureDate(5);

      await service.create({ ...baseCreateDto, startTime, durationMinutes: 90 });

      const createCall = mockPrisma.groupSession.create.mock.calls[0][0] as {
        data: { startTime: Date; endTime: Date };
      };
      const startMs = createCall.data.startTime.getTime();
      const endMs = createCall.data.endTime.getTime();

      expect(endMs - startMs).toBe(90 * 60 * 1000);
    });

    it('should throw BadRequestException if minParticipants > maxParticipants', async () => {
      await expect(
        service.create({ ...baseCreateDto, minParticipants: 15, maxParticipants: 10 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if fixed_date scheduling has no startTime', async () => {
      await expect(
        service.create({ ...baseCreateDto, schedulingMode: 'fixed_date', startTime: undefined }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if startTime is in the past', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 5);

      await expect(
        service.create({ ...baseCreateDto, startTime: pastDate.toISOString() }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create on_capacity session without startTime', async () => {
      const onCapacitySession = {
        ...baseSession,
        schedulingMode: 'on_capacity',
        startTime: null,
        endTime: null,
      };
      mockPrisma.groupSession.create.mockResolvedValue(onCapacitySession);

      const result = await service.create({
        ...baseCreateDto,
        schedulingMode: 'on_capacity',
        startTime: undefined,
      });

      expect(result.schedulingMode).toBe('on_capacity');
      expect(mockPrisma.groupSession.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            startTime: undefined,
            endTime: undefined,
          }),
        }),
      );
    });

    it('should default paymentDeadlineHours to 48 when not provided', async () => {
      mockPrisma.groupSession.create.mockResolvedValue(baseSession);

      await service.create({ ...baseCreateDto, paymentDeadlineHours: undefined });

      expect(mockPrisma.groupSession.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ paymentDeadlineHours: 48 }),
        }),
      );
    });

    it('should accept custom paymentDeadlineHours', async () => {
      mockPrisma.groupSession.create.mockResolvedValue(baseSession);

      await service.create({ ...baseCreateDto, paymentDeadlineHours: 72 });

      expect(mockPrisma.groupSession.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ paymentDeadlineHours: 72 }),
        }),
      );
    });

    it('should default isPublished to false when not provided', async () => {
      mockPrisma.groupSession.create.mockResolvedValue(baseSession);

      await service.create({ ...baseCreateDto, isPublished: undefined });

      expect(mockPrisma.groupSession.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ isPublished: false }),
        }),
      );
    });

    it('should create a free session when pricePerPersonHalalat is 0', async () => {
      const freeSession = { ...baseSession, pricePerPersonHalalat: 0 };
      mockPrisma.groupSession.create.mockResolvedValue(freeSession);

      const result = await service.create({ ...baseCreateDto, pricePerPersonHalalat: 0 });

      expect(result.pricePerPersonHalalat).toBe(0);
    });

    it('should set expiresAt when provided', async () => {
      mockPrisma.groupSession.create.mockResolvedValue(baseSession);
      const expiresAt = futureDate(30);

      await service.create({ ...baseCreateDto, expiresAt });

      expect(mockPrisma.groupSession.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            expiresAt: expect.any(Date),
          }),
        }),
      );
    });
  });

  // ─────────────────────────────────────────────────────────────
  // findAll
  // ─────────────────────────────────────────────────────────────

  describe('findAll', () => {
    const defaultQuery = { page: 1, perPage: 20 };

    it('should return paginated items with meta', async () => {
      mockPrisma.groupSession.findMany.mockResolvedValue([baseSession]);
      mockPrisma.groupSession.count.mockResolvedValue(1);

      const result = await service.findAll(defaultQuery);

      expect(result.items).toHaveLength(1);
      expect(result.meta).toEqual({
        total: 1,
        page: 1,
        perPage: 20,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      });
    });

    it('should calculate correct pagination for page 2', async () => {
      mockPrisma.groupSession.findMany.mockResolvedValue([]);
      mockPrisma.groupSession.count.mockResolvedValue(25);

      const result = await service.findAll({ page: 2, perPage: 20 });

      expect(result.meta.totalPages).toBe(2);
      expect(result.meta.hasNextPage).toBe(false);
      expect(result.meta.hasPreviousPage).toBe(true);
    });

    it('should filter by practitionerId', async () => {
      mockPrisma.groupSession.findMany.mockResolvedValue([]);
      mockPrisma.groupSession.count.mockResolvedValue(0);

      await service.findAll({ ...defaultQuery, practitionerId: 'prac-1' });

      expect(mockPrisma.groupSession.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ practitionerId: 'prac-1' }),
        }),
      );
    });

    it('should filter by status', async () => {
      mockPrisma.groupSession.findMany.mockResolvedValue([]);
      mockPrisma.groupSession.count.mockResolvedValue(0);

      await service.findAll({ ...defaultQuery, status: 'open' });

      expect(mockPrisma.groupSession.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'open' }),
        }),
      );
    });

    it('should filter by visibility=published', async () => {
      mockPrisma.groupSession.findMany.mockResolvedValue([]);
      mockPrisma.groupSession.count.mockResolvedValue(0);

      await service.findAll({ ...defaultQuery, visibility: 'published' });

      expect(mockPrisma.groupSession.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isPublished: true }),
        }),
      );
    });

    it('should filter by visibility=draft', async () => {
      mockPrisma.groupSession.findMany.mockResolvedValue([]);
      mockPrisma.groupSession.count.mockResolvedValue(0);

      await service.findAll({ ...defaultQuery, visibility: 'draft' });

      expect(mockPrisma.groupSession.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isPublished: false }),
        }),
      );
    });

    it('should search by nameAr and nameEn (case-insensitive)', async () => {
      mockPrisma.groupSession.findMany.mockResolvedValue([]);
      mockPrisma.groupSession.count.mockResolvedValue(0);

      await service.findAll({ ...defaultQuery, search: 'therapy' });

      expect(mockPrisma.groupSession.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { nameAr: { contains: 'therapy', mode: 'insensitive' } },
              { nameEn: { contains: 'therapy', mode: 'insensitive' } },
            ],
          }),
        }),
      );
    });

    it('should always exclude soft-deleted sessions (deletedAt: null)', async () => {
      mockPrisma.groupSession.findMany.mockResolvedValue([]);
      mockPrisma.groupSession.count.mockResolvedValue(0);

      await service.findAll(defaultQuery);

      expect(mockPrisma.groupSession.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ deletedAt: null }),
        }),
      );
    });

    it('should order results by createdAt desc', async () => {
      mockPrisma.groupSession.findMany.mockResolvedValue([]);
      mockPrisma.groupSession.count.mockResolvedValue(0);

      await service.findAll(defaultQuery);

      expect(mockPrisma.groupSession.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: 'desc' },
        }),
      );
    });

    it('should apply default page=1 and perPage=20 when not specified', async () => {
      mockPrisma.groupSession.findMany.mockResolvedValue([]);
      mockPrisma.groupSession.count.mockResolvedValue(0);

      await service.findAll({});

      expect(mockPrisma.groupSession.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
          take: 20,
        }),
      );
    });
  });

  // ─────────────────────────────────────────────────────────────
  // findOne
  // ─────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('should return session with enrollments and relations', async () => {
      const sessionWithEnrollments = {
        ...baseSession,
        enrollments: [
          {
            id: 'enrollment-1',
            patientId: 'patient-1',
            status: 'registered',
            patient: { id: 'patient-1', firstName: 'أحمد', lastName: 'محمد', phone: '+966501234567' },
            payment: null,
            createdAt: new Date(),
          },
        ],
      };
      mockPrisma.groupSession.findFirst.mockResolvedValue(sessionWithEnrollments);

      const result = await service.findOne('session-uuid-1');

      expect(result).toEqual(sessionWithEnrollments);
      expect(result.enrollments).toHaveLength(1);
    });

    it('should throw NotFoundException for non-existent session', async () => {
      mockPrisma.groupSession.findFirst.mockResolvedValue(null);

      await expect(service.findOne('non-existent-id')).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException for soft-deleted session', async () => {
      mockPrisma.groupSession.findFirst.mockResolvedValue(null);

      await expect(service.findOne('deleted-session-id')).rejects.toThrow(NotFoundException);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // UPDATE
  // ─────────────────────────────────────────────────────────────

  describe('update', () => {
    beforeEach(() => {
      mockPrisma.groupSession.findFirst.mockResolvedValue(baseSession);
    });

    it('should update session fields', async () => {
      const updatedSession = { ...baseSession, nameEn: 'Updated Session' };
      mockPrisma.groupSession.update.mockResolvedValue(updatedSession);

      const result = await service.update('session-uuid-1', { nameEn: 'Updated Session' });

      expect(result.nameEn).toBe('Updated Session');
      expect(mockPrisma.groupSession.update).toHaveBeenCalled();
    });

    it('should throw BadRequestException if updated minParticipants > maxParticipants', async () => {
      await expect(
        service.update('session-uuid-1', { minParticipants: 20, maxParticipants: 10 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if startTime is in the past', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 3);

      await expect(
        service.update('session-uuid-1', { startTime: pastDate.toISOString() }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should recalculate endTime when startTime changes', async () => {
      const updatedSession = {
        ...baseSession,
        startTime: new Date(futureDate(10)),
        endTime: new Date(new Date(futureDate(10)).getTime() + 60 * 60 * 1000),
      };
      mockPrisma.groupSession.update.mockResolvedValue(updatedSession);

      await service.update('session-uuid-1', { startTime: futureDate(10) });

      const updateCall = mockPrisma.groupSession.update.mock.calls[0][0] as {
        data: { startTime: Date; endTime: Date };
      };
      const duration = updateCall.data.endTime.getTime() - updateCall.data.startTime.getTime();
      expect(duration).toBe(60 * 60 * 1000);
    });

    it('should recalculate endTime using new durationMinutes when both provided', async () => {
      mockPrisma.groupSession.update.mockResolvedValue(baseSession);

      await service.update('session-uuid-1', { startTime: futureDate(10), durationMinutes: 120 });

      const updateCall = mockPrisma.groupSession.update.mock.calls[0][0] as {
        data: { startTime: Date; endTime: Date };
      };
      const duration = updateCall.data.endTime.getTime() - updateCall.data.startTime.getTime();
      expect(duration).toBe(120 * 60 * 1000);
    });

    it('should trigger confirmSessionAfterDateSet when setting date on on_capacity session with enough enrollments', async () => {
      const onCapacitySession = {
        ...baseSession,
        schedulingMode: 'on_capacity',
        startTime: null,
        currentEnrollment: 5,
        minParticipants: 3,
        status: 'open',
      };
      mockPrisma.groupSession.findFirst.mockResolvedValue(onCapacitySession);
      mockPrisma.groupSession.update.mockResolvedValue({
        ...onCapacitySession,
        startTime: new Date(futureDate(5)),
        status: 'confirmed',
      });
      mockPrisma.groupSession.findUnique.mockResolvedValue({ pricePerPersonHalalat: 100 });
      mockPrisma.groupEnrollment.findMany.mockResolvedValue([
        { id: 'enr-1', patientId: 'patient-1' },
        { id: 'enr-2', patientId: 'patient-2' },
      ]);

      await service.update('session-uuid-1', { startTime: futureDate(5) });

      expect(mockPrisma.groupSession.update).toHaveBeenCalledTimes(2);
    });

    it('should NOT trigger confirmSessionAfterDateSet for on_capacity session with insufficient enrollment', async () => {
      const onCapacitySession = {
        ...baseSession,
        schedulingMode: 'on_capacity',
        startTime: null,
        currentEnrollment: 1,
        minParticipants: 3,
        status: 'open',
      };
      mockPrisma.groupSession.findFirst.mockResolvedValue(onCapacitySession);
      mockPrisma.groupSession.update.mockResolvedValue({
        ...onCapacitySession,
        startTime: new Date(futureDate(5)),
      });

      await service.update('session-uuid-1', { startTime: futureDate(5) });

      expect(mockPrisma.groupSession.update).toHaveBeenCalledTimes(1);
    });

    it('should throw NotFoundException when session not found', async () => {
      mockPrisma.groupSession.findFirst.mockResolvedValue(null);

      await expect(
        service.update('non-existent-id', { nameEn: 'Test' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // REMOVE (soft delete)
  // ─────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('should soft delete a session by setting deletedAt', async () => {
      mockPrisma.groupSession.findFirst.mockResolvedValue(baseSession);
      mockPrisma.groupSession.update.mockResolvedValue({ ...baseSession, deletedAt: new Date() });

      const result = await service.remove('session-uuid-1');

      expect(result).toEqual({ deleted: true });
      expect(mockPrisma.groupSession.update).toHaveBeenCalledWith({
        where: { id: 'session-uuid-1' },
        data: { deletedAt: expect.any(Date) },
      });
    });

    it('should throw NotFoundException for non-existent session', async () => {
      mockPrisma.groupSession.findFirst.mockResolvedValue(null);

      await expect(service.remove('non-existent-id')).rejects.toThrow(NotFoundException);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // CANCEL
  // ─────────────────────────────────────────────────────────────

  describe('cancel', () => {
    it('should cancel an open session and its active enrollments', async () => {
      const sessionWithEnrollments = {
        ...baseSession,
        status: 'open',
        enrollments: [
          { id: 'enr-1', patientId: 'patient-1', status: 'registered' },
          { id: 'enr-2', patientId: 'patient-2', status: 'confirmed' },
        ],
      };
      mockPrisma.groupSession.findFirst.mockResolvedValue(sessionWithEnrollments);

      const result = await service.cancel('session-uuid-1');

      expect(result).toEqual({ cancelled: true });
      expect(mockPrisma.groupSession.update).toHaveBeenCalledWith({
        where: { id: 'session-uuid-1' },
        data: { status: 'cancelled' },
      });
      expect(mockPrisma.groupEnrollment.updateMany).toHaveBeenCalledWith({
        where: {
          groupSessionId: 'session-uuid-1',
          status: { in: ['registered', 'confirmed'] },
        },
        data: { status: 'cancelled' },
      });
    });

    it('should send notifications to registered and confirmed patients', async () => {
      const sessionWithEnrollments = {
        ...baseSession,
        status: 'confirmed',
        enrollments: [
          { id: 'enr-1', patientId: 'patient-1', status: 'registered' },
          { id: 'enr-2', patientId: 'patient-2', status: 'confirmed' },
          { id: 'enr-3', patientId: 'patient-3', status: 'cancelled' },
        ],
      };
      mockPrisma.groupSession.findFirst.mockResolvedValue(sessionWithEnrollments);

      await service.cancel('session-uuid-1');

      expect(mockNotificationsService.createNotification).toHaveBeenCalledTimes(2);
    });

    it('should not send notifications when no active enrollments exist', async () => {
      const sessionNoEnrollments = {
        ...baseSession,
        status: 'open',
        enrollments: [],
      };
      mockPrisma.groupSession.findFirst.mockResolvedValue(sessionNoEnrollments);

      await service.cancel('session-uuid-1');

      expect(mockNotificationsService.createNotification).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when cancelling a completed session', async () => {
      const completedSession = {
        ...baseSession,
        status: 'completed',
        enrollments: [],
      };
      mockPrisma.groupSession.findFirst.mockResolvedValue(completedSession);

      await expect(service.cancel('session-uuid-1')).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when cancelling an already cancelled session', async () => {
      const cancelledSession = {
        ...baseSession,
        status: 'cancelled',
        enrollments: [],
      };
      mockPrisma.groupSession.findFirst.mockResolvedValue(cancelledSession);

      await expect(service.cancel('session-uuid-1')).rejects.toThrow(BadRequestException);
    });

    it('should not throw when notification fails (should swallow error)', async () => {
      const sessionWithEnrollments = {
        ...baseSession,
        status: 'open',
        enrollments: [{ id: 'enr-1', patientId: 'patient-1', status: 'registered' }],
      };
      mockPrisma.groupSession.findFirst.mockResolvedValue(sessionWithEnrollments);
      mockNotificationsService.createNotification.mockRejectedValueOnce(new Error('Push failed'));

      const result = await service.cancel('session-uuid-1');
      expect(result).toEqual({ cancelled: true });
    });
  });

  // ─────────────────────────────────────────────────────────────
  // COMPLETE
  // ─────────────────────────────────────────────────────────────

  describe('complete', () => {
    it('should complete a confirmed session and mark attended patients', async () => {
      const confirmedSession = {
        ...baseSession,
        status: 'confirmed',
        enrollments: [
          { id: 'enr-1', patientId: 'patient-1', status: 'confirmed' },
          { id: 'enr-2', patientId: 'patient-2', status: 'confirmed' },
        ],
      };
      mockPrisma.groupSession.findFirst.mockResolvedValue(confirmedSession);

      const result = await service.complete('session-uuid-1', ['patient-1']);

      expect(result).toEqual({ completed: true });
      expect(mockPrisma.groupSession.update).toHaveBeenCalledWith({
        where: { id: 'session-uuid-1' },
        data: { status: 'completed' },
      });
      expect(mockPrisma.groupEnrollment.updateMany).toHaveBeenCalledWith({
        where: {
          groupSessionId: 'session-uuid-1',
          patientId: { in: ['patient-1'] },
          status: 'confirmed',
        },
        data: { status: 'attended' },
      });
    });

    it('should complete a full session', async () => {
      const fullSession = {
        ...baseSession,
        status: 'full',
        currentEnrollment: 10,
        enrollments: [],
      };
      mockPrisma.groupSession.findFirst.mockResolvedValue(fullSession);

      const result = await service.complete('session-uuid-1', []);

      expect(result).toEqual({ completed: true });
    });

    it('should throw BadRequestException when completing an open session', async () => {
      mockPrisma.groupSession.findFirst.mockResolvedValue({ ...baseSession, status: 'open' });

      await expect(service.complete('session-uuid-1', [])).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when completing a cancelled session', async () => {
      mockPrisma.groupSession.findFirst.mockResolvedValue({ ...baseSession, status: 'cancelled' });

      await expect(service.complete('session-uuid-1', [])).rejects.toThrow(BadRequestException);
    });

    it('should work with empty attendedPatientIds (no attendance marked)', async () => {
      const confirmedSession = {
        ...baseSession,
        status: 'confirmed',
        enrollments: [],
      };
      mockPrisma.groupSession.findFirst.mockResolvedValue(confirmedSession);

      const result = await service.complete('session-uuid-1', []);

      expect(result).toEqual({ completed: true });
      expect(mockPrisma.groupEnrollment.updateMany).not.toHaveBeenCalled();
    });
  });
});
