/**
 * CoursesEnrollmentsService — Unit Tests
 * Covers: enroll (free/paid), dropEnrollment, refundEnrollment
 */
import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { CoursesEnrollmentsService } from '../../../src/modules/courses/courses-enrollments.service.js';
import { PrismaService } from '../../../src/database/prisma.service.js';
import { NotificationsService } from '../../../src/modules/notifications/notifications.service.js';

const mockNotificationsService = {
  createNotification: jest.fn().mockResolvedValue({ id: 'notif-1' }),
};

type MockPrisma = {
  course: { findFirst: jest.Mock; update: jest.Mock };
  courseEnrollment: { create: jest.Mock; findFirst: jest.Mock; findUnique: jest.Mock; update: jest.Mock };
  coursePayment: { create: jest.Mock; update: jest.Mock };
  $transaction: jest.Mock;
};

const mockPrisma: MockPrisma = {
  course: {
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  courseEnrollment: {
    create: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  coursePayment: {
    create: jest.fn(),
    update: jest.fn(),
  },
  $transaction: jest.fn((fn: unknown) => {
    if (typeof fn === 'function') {
      return (fn as (tx: MockPrisma) => Promise<unknown>)(mockPrisma);
    }
    return Promise.all(fn as Promise<unknown>[]);
  }),
};

const freeCourse = {
  id: 'course-uuid-1',
  nameAr: 'دورة مجانية',
  nameEn: 'Free Course',
  priceHalalat: 0,
  isGroup: false,
  maxParticipants: null,
  currentEnrollment: 0,
  status: 'published' as const,
};

const paidCourse = {
  id: 'course-uuid-2',
  nameAr: 'دورة مدفوعة',
  nameEn: 'Paid Course',
  priceHalalat: 5000,
  isGroup: false,
  maxParticipants: null,
  currentEnrollment: 0,
  status: 'published' as const,
};

const groupCourse = {
  id: 'course-uuid-3',
  nameAr: 'دورة جماعية',
  nameEn: 'Group Course',
  priceHalalat: 0,
  isGroup: true,
  maxParticipants: 5,
  currentEnrollment: 5, // full
  status: 'published' as const,
};

describe('CoursesEnrollmentsService', () => {
  let service: CoursesEnrollmentsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CoursesEnrollmentsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: NotificationsService, useValue: mockNotificationsService },
      ],
    }).compile();

    service = module.get<CoursesEnrollmentsService>(CoursesEnrollmentsService);
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
  // enroll — free course
  // ─────────────────────────────────────────────────────────────

  describe('enroll — free course', () => {
    it('should create enrollment with status=active for free course', async () => {
      mockPrisma.course.findFirst.mockResolvedValue(freeCourse);
      mockPrisma.courseEnrollment.findFirst.mockResolvedValue(null);
      mockPrisma.courseEnrollment.create.mockResolvedValue({
        id: 'enr-1', courseId: 'course-uuid-1', patientId: 'patient-1', status: 'active',
      });
      mockPrisma.course.update.mockResolvedValue({ ...freeCourse, currentEnrollment: 1 });

      const result = await service.enroll('course-uuid-1', 'patient-1');

      expect(mockPrisma.courseEnrollment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'active' }),
        }),
      );
      expect(result).toMatchObject({ status: 'active' });
    });

    it('should send enrollment notification for free course', async () => {
      mockPrisma.course.findFirst.mockResolvedValue(freeCourse);
      mockPrisma.courseEnrollment.findFirst.mockResolvedValue(null);
      mockPrisma.courseEnrollment.create.mockResolvedValue({ id: 'enr-1', status: 'active' });
      mockPrisma.course.update.mockResolvedValue(freeCourse);

      await service.enroll('course-uuid-1', 'patient-1');

      expect(mockNotificationsService.createNotification).toHaveBeenCalledTimes(1);
    });

    it('should not throw if notification fails (fire and forget)', async () => {
      mockPrisma.course.findFirst.mockResolvedValue(freeCourse);
      mockPrisma.courseEnrollment.findFirst.mockResolvedValue(null);
      mockPrisma.courseEnrollment.create.mockResolvedValue({ id: 'enr-1', status: 'active' });
      mockPrisma.course.update.mockResolvedValue(freeCourse);
      mockNotificationsService.createNotification.mockRejectedValueOnce(new Error('FCM failed'));

      await expect(service.enroll('course-uuid-1', 'patient-1')).resolves.toBeDefined();
    });
  });

  // ─────────────────────────────────────────────────────────────
  // enroll — paid course
  // ─────────────────────────────────────────────────────────────

  describe('enroll — paid course', () => {
    it('should create enrollment with status=enrolled for paid course', async () => {
      mockPrisma.course.findFirst.mockResolvedValue(paidCourse);
      mockPrisma.courseEnrollment.findFirst.mockResolvedValue(null);
      mockPrisma.courseEnrollment.create.mockResolvedValue({
        id: 'enr-2', courseId: 'course-uuid-2', patientId: 'patient-1', status: 'enrolled',
      });
      mockPrisma.coursePayment.create.mockResolvedValue({ id: 'pay-1', status: 'pending' });
      mockPrisma.course.update.mockResolvedValue({ ...paidCourse, currentEnrollment: 1 });

      const result = await service.enroll('course-uuid-2', 'patient-1') as { enrollment: { status: string }; paymentUrl: null };

      expect(result.enrollment.status).toBe('enrolled');
      expect(result.paymentUrl).toBeNull();
    });

    it('should create a CoursePayment record for paid enrollment', async () => {
      mockPrisma.course.findFirst.mockResolvedValue(paidCourse);
      mockPrisma.courseEnrollment.findFirst.mockResolvedValue(null);
      mockPrisma.courseEnrollment.create.mockResolvedValue({ id: 'enr-2', status: 'enrolled' });
      mockPrisma.coursePayment.create.mockResolvedValue({ id: 'pay-1' });
      mockPrisma.course.update.mockResolvedValue(paidCourse);

      await service.enroll('course-uuid-2', 'patient-1');

      expect(mockPrisma.coursePayment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            amount: 5000,
            method: 'moyasar',
            status: 'pending',
          }),
        }),
      );
    });
  });

  // ─────────────────────────────────────────────────────────────
  // enroll — validation
  // ─────────────────────────────────────────────────────────────

  describe('enroll — validation', () => {
    it('should throw NotFoundException if course not found', async () => {
      mockPrisma.course.findFirst.mockResolvedValue(null);

      await expect(service.enroll('non-existent', 'patient-1')).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if course is not published or in_progress', async () => {
      mockPrisma.course.findFirst.mockResolvedValue({ ...freeCourse, status: 'draft' });

      await expect(service.enroll('course-uuid-1', 'patient-1')).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if course is archived', async () => {
      mockPrisma.course.findFirst.mockResolvedValue({ ...freeCourse, status: 'archived' });

      await expect(service.enroll('course-uuid-1', 'patient-1')).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if group course is full', async () => {
      mockPrisma.course.findFirst.mockResolvedValue(groupCourse);

      await expect(service.enroll('course-uuid-3', 'patient-1')).rejects.toThrow(BadRequestException);
    });

    it('should throw ConflictException if patient is already enrolled', async () => {
      mockPrisma.course.findFirst.mockResolvedValue(freeCourse);
      mockPrisma.courseEnrollment.findFirst.mockResolvedValue({
        id: 'existing-enr', status: 'active',
      });

      await expect(service.enroll('course-uuid-1', 'patient-1')).rejects.toThrow(ConflictException);
    });

    it('should allow re-enrollment if previous enrollment was dropped', async () => {
      mockPrisma.course.findFirst.mockResolvedValue(freeCourse);
      mockPrisma.courseEnrollment.findFirst.mockResolvedValue(null); // notIn dropped/refunded returns null
      mockPrisma.courseEnrollment.create.mockResolvedValue({ id: 'enr-new', status: 'active' });
      mockPrisma.course.update.mockResolvedValue(freeCourse);

      await expect(service.enroll('course-uuid-1', 'patient-1')).resolves.toBeDefined();
    });
  });

  // ─────────────────────────────────────────────────────────────
  // dropEnrollment
  // ─────────────────────────────────────────────────────────────

  describe('dropEnrollment', () => {
    it('should drop an enrolled enrollment', async () => {
      mockPrisma.courseEnrollment.findUnique.mockResolvedValue({
        id: 'enr-1', courseId: 'course-uuid-1', status: 'enrolled',
      });

      const result = await service.dropEnrollment('enr-1');

      expect(result).toEqual({ dropped: true });
      expect(mockPrisma.courseEnrollment.update).toHaveBeenCalledWith({
        where: { id: 'enr-1' },
        data: { status: 'dropped' },
      });
    });

    it('should drop an active enrollment', async () => {
      mockPrisma.courseEnrollment.findUnique.mockResolvedValue({
        id: 'enr-1', courseId: 'course-uuid-1', status: 'active',
      });

      const result = await service.dropEnrollment('enr-1');
      expect(result).toEqual({ dropped: true });
    });

    it('should throw NotFoundException if enrollment not found', async () => {
      mockPrisma.courseEnrollment.findUnique.mockResolvedValue(null);

      await expect(service.dropEnrollment('non-existent')).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if enrollment is already dropped', async () => {
      mockPrisma.courseEnrollment.findUnique.mockResolvedValue({
        id: 'enr-1', courseId: 'course-uuid-1', status: 'dropped',
      });

      await expect(service.dropEnrollment('enr-1')).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if enrollment is completed', async () => {
      mockPrisma.courseEnrollment.findUnique.mockResolvedValue({
        id: 'enr-1', courseId: 'course-uuid-1', status: 'completed',
      });

      await expect(service.dropEnrollment('enr-1')).rejects.toThrow(BadRequestException);
    });

    it('should decrement course currentEnrollment on drop', async () => {
      mockPrisma.courseEnrollment.findUnique.mockResolvedValue({
        id: 'enr-1', courseId: 'course-uuid-1', status: 'enrolled',
      });

      await service.dropEnrollment('enr-1');

      expect(mockPrisma.course.update).toHaveBeenCalledWith({
        where: { id: 'course-uuid-1' },
        data: { currentEnrollment: { decrement: 1 } },
      });
    });
  });

  // ─────────────────────────────────────────────────────────────
  // refundEnrollment
  // ─────────────────────────────────────────────────────────────

  describe('refundEnrollment', () => {
    it('should refund a dropped enrollment with payment', async () => {
      mockPrisma.courseEnrollment.findUnique.mockResolvedValue({
        id: 'enr-1', status: 'dropped', payment: { id: 'pay-1' },
      });
      mockPrisma.courseEnrollment.update.mockResolvedValue({ id: 'enr-1', status: 'refunded' });
      mockPrisma.coursePayment.update.mockResolvedValue({ id: 'pay-1', status: 'refunded' });

      const result = await service.refundEnrollment('enr-1');

      expect(result).toEqual({ refunded: true });
      expect(mockPrisma.coursePayment.update).toHaveBeenCalledWith({
        where: { id: 'pay-1' },
        data: { status: 'refunded', refundedAt: expect.any(Date) },
      });
    });

    it('should refund without payment update if no payment exists', async () => {
      mockPrisma.courseEnrollment.findUnique.mockResolvedValue({
        id: 'enr-1', status: 'dropped', payment: null,
      });
      mockPrisma.courseEnrollment.update.mockResolvedValue({ id: 'enr-1', status: 'refunded' });

      const result = await service.refundEnrollment('enr-1');

      expect(result).toEqual({ refunded: true });
      expect(mockPrisma.coursePayment.update).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException if enrollment not found', async () => {
      mockPrisma.courseEnrollment.findUnique.mockResolvedValue(null);

      await expect(service.refundEnrollment('non-existent')).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if enrollment is not dropped', async () => {
      mockPrisma.courseEnrollment.findUnique.mockResolvedValue({
        id: 'enr-1', status: 'active', payment: null,
      });

      await expect(service.refundEnrollment('enr-1')).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if trying to refund an enrolled (not yet dropped) enrollment', async () => {
      mockPrisma.courseEnrollment.findUnique.mockResolvedValue({
        id: 'enr-1', status: 'enrolled', payment: { id: 'pay-1' },
      });

      await expect(service.refundEnrollment('enr-1')).rejects.toThrow(BadRequestException);
    });
  });
});
