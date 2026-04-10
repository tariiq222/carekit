/**
 * CoursesService — Unit Tests
 * Covers: create, findAll, findOne, remove, publish, cancel, markAttendance
 */
import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { CoursesService } from '../../../src/modules/courses/courses.service.js';
import { PrismaService } from '../../../src/database/prisma.service.js';
import { NotificationsService } from '../../../src/modules/notifications/notifications.service.js';
import { CourseQueryDto } from '../../../src/modules/courses/dto/course-query.dto.js';

const mockNotificationsService = {
  createNotification: jest.fn().mockResolvedValue({ id: 'notif-1' }),
};

type MockPrisma = {
  course: {
    create: jest.Mock;
    findMany: jest.Mock;
    findFirst: jest.Mock;
    update: jest.Mock;
    count: jest.Mock;
  };
  courseSession: { findFirst: jest.Mock; update: jest.Mock; count: jest.Mock };
  courseEnrollment: { updateMany: jest.Mock; findMany: jest.Mock };
  $transaction: jest.Mock;
};

const mockPrisma: MockPrisma = {
  course: {
    create: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  courseSession: {
    findFirst: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  courseEnrollment: {
    updateMany: jest.fn(),
    findMany: jest.fn(),
  },
  $transaction: jest.fn((fn: unknown) => {
    if (typeof fn === 'function') {
      return (fn as (tx: MockPrisma) => Promise<unknown>)(mockPrisma);
    }
    return Promise.all(fn as Promise<unknown>[]);
  }),
};

const futureDate = (daysFromNow = 7) => {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString();
};

const baseCourse = {
  id: 'course-uuid-1',
  nameAr: 'دورة إدارة القلق',
  nameEn: 'Anxiety Management Course',
  descriptionAr: 'وصف الدورة',
  descriptionEn: 'Course description',
  practitionerId: 'practitioner-uuid-1',
  departmentId: null,
  totalSessions: 8,
  durationPerSessionMin: 60,
  frequency: 'weekly' as const,
  priceHalalat: 0,
  isGroup: false,
  maxParticipants: null,
  deliveryMode: 'in_person' as const,
  location: 'القاعة A',
  status: 'draft' as const,
  startDate: new Date(futureDate(7)),
  currentEnrollment: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  practitioner: { id: 'practitioner-uuid-1', nameAr: 'د. أحمد' },
  sessions: [],
  enrollments: [],
};

const baseCreateDto = {
  nameAr: 'دورة إدارة القلق',
  nameEn: 'Anxiety Management Course',
  practitionerId: 'practitioner-uuid-1',
  totalSessions: 8,
  durationPerSessionMin: 60,
  frequency: 'weekly' as const,
  priceHalalat: 0,
  isGroup: false,
  deliveryMode: 'in_person' as const,
  location: 'القاعة A',
  startDate: futureDate(7),
};

describe('CoursesService', () => {
  let service: CoursesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CoursesService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: NotificationsService, useValue: mockNotificationsService },
      ],
    }).compile();

    service = module.get<CoursesService>(CoursesService);
    jest.resetAllMocks();
    mockNotificationsService.createNotification.mockResolvedValue({ id: 'notif-1' });
    mockPrisma.$transaction.mockImplementation((fn: unknown) => {
      if (typeof fn === 'function') {
        return (fn as (tx: MockPrisma) => Promise<unknown>)(mockPrisma);
      }
      return Promise.all(fn as Promise<unknown>[]);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // CREATE
  // ─────────────────────────────────────────────────────────────

  describe('create', () => {
    it('should create a course with generated sessions', async () => {
      mockPrisma.course.create.mockResolvedValue({
        ...baseCourse,
        sessions: Array.from({ length: 8 }, (_, i) => ({ id: `session-${i}`, sessionNumber: i + 1 })),
      });

      const result = await service.create(baseCreateDto);

      expect(mockPrisma.course.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            nameAr: 'دورة إدارة القلق',
            totalSessions: 8,
            frequency: 'weekly',
            sessions: { create: expect.arrayContaining([expect.objectContaining({ sessionNumber: 1 })]) },
          }),
        }),
      );
      expect(result.sessions).toHaveLength(8);
    });

    it('should throw BadRequestException if startDate is in the past', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      await expect(
        service.create({ ...baseCreateDto, startDate: pastDate.toISOString() }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if isGroup=true but maxParticipants not provided', async () => {
      await expect(
        service.create({ ...baseCreateDto, isGroup: true, maxParticipants: undefined }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should allow isGroup=true with maxParticipants provided', async () => {
      const groupCourse = { ...baseCourse, isGroup: true, maxParticipants: 10 };
      mockPrisma.course.create.mockResolvedValue(groupCourse);

      const result = await service.create({ ...baseCreateDto, isGroup: true, maxParticipants: 10 });

      expect(result.isGroup).toBe(true);
      expect(result.maxParticipants).toBe(10);
    });

    it('should generate 8 weekly session dates correctly', async () => {
      mockPrisma.course.create.mockResolvedValue(baseCourse);

      await service.create({ ...baseCreateDto, totalSessions: 8, frequency: 'weekly' });

      const createCall = mockPrisma.course.create.mock.calls[0][0] as {
        data: { sessions: { create: { scheduledAt: Date; sessionNumber: number }[] } };
      };
      const sessions = createCall.data.sessions.create;
      expect(sessions).toHaveLength(8);

      // each session 7 days apart
      const diff = sessions[1].scheduledAt.getTime() - sessions[0].scheduledAt.getTime();
      expect(diff).toBe(7 * 24 * 60 * 60 * 1000);
    });

    it('should generate biweekly sessions 14 days apart', async () => {
      mockPrisma.course.create.mockResolvedValue(baseCourse);

      await service.create({ ...baseCreateDto, frequency: 'biweekly' });

      const createCall = mockPrisma.course.create.mock.calls[0][0] as {
        data: { sessions: { create: { scheduledAt: Date }[] } };
      };
      const sessions = createCall.data.sessions.create;
      const diff = sessions[1].scheduledAt.getTime() - sessions[0].scheduledAt.getTime();
      expect(diff).toBe(14 * 24 * 60 * 60 * 1000);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // findAll
  // ─────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('should return paginated courses with meta', async () => {
      mockPrisma.course.findMany.mockResolvedValue([baseCourse]);
      mockPrisma.course.count.mockResolvedValue(1);

      const result = await service.findAll({ page: 1, perPage: 20 } as CourseQueryDto);

      expect(result.items).toHaveLength(1);
      expect(result.meta).toMatchObject({ total: 1, page: 1, totalPages: 1 });
    });

    it('should filter by status', async () => {
      mockPrisma.course.findMany.mockResolvedValue([]);
      mockPrisma.course.count.mockResolvedValue(0);

      await service.findAll({ status: 'published' } as CourseQueryDto);

      expect(mockPrisma.course.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'published' }),
        }),
      );
    });

    it('should filter by practitionerId', async () => {
      mockPrisma.course.findMany.mockResolvedValue([]);
      mockPrisma.course.count.mockResolvedValue(0);

      await service.findAll({ practitionerId: 'prac-1' } as CourseQueryDto);

      expect(mockPrisma.course.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ practitionerId: 'prac-1' }),
        }),
      );
    });

    it('should always exclude soft-deleted courses', async () => {
      mockPrisma.course.findMany.mockResolvedValue([]);
      mockPrisma.course.count.mockResolvedValue(0);

      await service.findAll({} as CourseQueryDto);

      expect(mockPrisma.course.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ deletedAt: null }),
        }),
      );
    });

    it('should search by nameAr and nameEn', async () => {
      mockPrisma.course.findMany.mockResolvedValue([]);
      mockPrisma.course.count.mockResolvedValue(0);

      await service.findAll({ search: 'anxiety' } as CourseQueryDto);

      expect(mockPrisma.course.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { nameAr: { contains: 'anxiety', mode: 'insensitive' } },
              { nameEn: { contains: 'anxiety', mode: 'insensitive' } },
            ],
          }),
        }),
      );
    });
  });

  // ─────────────────────────────────────────────────────────────
  // findOne
  // ─────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('should return course with sessions and enrollments', async () => {
      const courseWithRelations = { ...baseCourse, sessions: [{ id: 's-1', sessionNumber: 1 }] };
      mockPrisma.course.findFirst.mockResolvedValue(courseWithRelations);

      const result = await service.findOne('course-uuid-1');
      expect(result).toEqual(courseWithRelations);
    });

    it('should throw NotFoundException for non-existent course', async () => {
      mockPrisma.course.findFirst.mockResolvedValue(null);

      await expect(service.findOne('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // remove
  // ─────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('should soft delete a draft course', async () => {
      mockPrisma.course.findFirst.mockResolvedValue({ ...baseCourse, status: 'draft' });
      mockPrisma.course.update.mockResolvedValue({ ...baseCourse, deletedAt: new Date() });

      const result = await service.remove('course-uuid-1');

      expect(result).toEqual({ deleted: true });
      expect(mockPrisma.course.update).toHaveBeenCalledWith({
        where: { id: 'course-uuid-1' },
        data: { deletedAt: expect.any(Date) },
      });
    });

    it('should throw BadRequestException if status is published', async () => {
      mockPrisma.course.findFirst.mockResolvedValue({ ...baseCourse, status: 'published' });

      await expect(service.remove('course-uuid-1')).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if status is in_progress', async () => {
      mockPrisma.course.findFirst.mockResolvedValue({ ...baseCourse, status: 'in_progress' });

      await expect(service.remove('course-uuid-1')).rejects.toThrow(BadRequestException);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // publish
  // ─────────────────────────────────────────────────────────────

  describe('publish', () => {
    it('should publish a draft course', async () => {
      mockPrisma.course.findFirst.mockResolvedValue({ ...baseCourse, status: 'draft' });
      mockPrisma.course.update.mockResolvedValue({ ...baseCourse, status: 'published' });

      const result = await service.publish('course-uuid-1');

      expect(result.status).toBe('published');
      expect(mockPrisma.course.update).toHaveBeenCalledWith({
        where: { id: 'course-uuid-1' },
        data: { status: 'published' },
        include: expect.anything(),
      });
    });

    it('should throw BadRequestException if status is not draft', async () => {
      mockPrisma.course.findFirst.mockResolvedValue({ ...baseCourse, status: 'published' });

      await expect(service.publish('course-uuid-1')).rejects.toThrow(BadRequestException);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // cancel
  // ─────────────────────────────────────────────────────────────

  describe('cancel', () => {
    it('should cancel a published course and drop active enrollments', async () => {
      const publishedCourse = {
        ...baseCourse,
        status: 'published',
        enrollments: [
          { id: 'enr-1', patientId: 'patient-1', status: 'enrolled' },
          { id: 'enr-2', patientId: 'patient-2', status: 'active' },
        ],
      };
      mockPrisma.course.findFirst.mockResolvedValue(publishedCourse);

      const result = await service.cancel('course-uuid-1');

      expect(result).toEqual({ cancelled: true });
    });

    it('should send cancellation notifications to active enrollments', async () => {
      const publishedCourse = {
        ...baseCourse,
        status: 'published',
        enrollments: [
          { id: 'enr-1', patientId: 'patient-1', status: 'enrolled' },
          { id: 'enr-2', patientId: 'patient-2', status: 'active' },
          { id: 'enr-3', patientId: 'patient-3', status: 'dropped' }, // should NOT be notified
        ],
      };
      mockPrisma.course.findFirst.mockResolvedValue(publishedCourse);

      await service.cancel('course-uuid-1');

      // Only 2 active enrollments notified
      expect(mockNotificationsService.createNotification).toHaveBeenCalledTimes(2);
    });

    it('should throw BadRequestException if status is completed', async () => {
      mockPrisma.course.findFirst.mockResolvedValue({ ...baseCourse, status: 'completed', enrollments: [] });

      await expect(service.cancel('course-uuid-1')).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if status is archived', async () => {
      mockPrisma.course.findFirst.mockResolvedValue({ ...baseCourse, status: 'archived', enrollments: [] });

      await expect(service.cancel('course-uuid-1')).rejects.toThrow(BadRequestException);
    });

    it('should not throw if notification fails (fire and forget)', async () => {
      mockPrisma.course.findFirst.mockResolvedValue({
        ...baseCourse,
        status: 'published',
        enrollments: [{ id: 'enr-1', patientId: 'patient-1', status: 'enrolled' }],
      });
      mockNotificationsService.createNotification.mockRejectedValueOnce(new Error('Push failed'));

      const result = await service.cancel('course-uuid-1');
      expect(result).toEqual({ cancelled: true });
    });
  });

  // ─────────────────────────────────────────────────────────────
  // markAttendance
  // ─────────────────────────────────────────────────────────────

  describe('markAttendance', () => {
    const attendanceDto = {
      sessionId: 'session-uuid-1',
      attendedPatientIds: ['patient-1', 'patient-2'],
    };

    it('should mark session completed and increment sessionsAttended', async () => {
      mockPrisma.course.findFirst.mockResolvedValue({ ...baseCourse, totalSessions: 8, enrollments: [] });
      mockPrisma.courseSession.findFirst.mockResolvedValue({
        id: 'session-uuid-1',
        courseId: 'course-uuid-1',
        sessionNumber: 3,
        status: 'scheduled',
      });
      mockPrisma.courseSession.count.mockResolvedValue(0);

      const result = await service.markAttendance('course-uuid-1', attendanceDto);

      expect(result).toMatchObject({ marked: true, sessionNumber: 3 });
    });

    it('should throw NotFoundException if session not found or not scheduled', async () => {
      mockPrisma.course.findFirst.mockResolvedValue({ ...baseCourse, enrollments: [] });
      mockPrisma.courseSession.findFirst.mockResolvedValue(null);

      await expect(service.markAttendance('course-uuid-1', attendanceDto)).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if session belongs to different course', async () => {
      mockPrisma.course.findFirst.mockResolvedValue({ ...baseCourse, enrollments: [] });
      mockPrisma.courseSession.findFirst.mockResolvedValue(null); // findFirst with courseId filter returns null

      await expect(
        service.markAttendance('course-uuid-1', { sessionId: 'other-course-session', attendedPatientIds: [] }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should not throw if attendance notification fails', async () => {
      mockPrisma.course.findFirst.mockResolvedValue({ ...baseCourse, totalSessions: 8, enrollments: [] });
      mockPrisma.courseSession.findFirst.mockResolvedValue({
        id: 'session-uuid-1', courseId: 'course-uuid-1', sessionNumber: 1, status: 'scheduled',
      });
      mockPrisma.courseSession.count.mockResolvedValue(0);
      mockNotificationsService.createNotification.mockRejectedValue(new Error('FCM error'));

      const result = await service.markAttendance('course-uuid-1', attendanceDto);
      expect(result).toMatchObject({ marked: true });
    });
  });
});
