/**
 * GroupSessionsEnrollmentsService — Unit Tests
 * Covers: enroll, cancelEnrollment, removeEnrollment, notification flows
 */
import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { GroupSessionsEnrollmentsService } from '../../../src/modules/group-sessions/group-sessions-enrollments.service.js';
import { PrismaService } from '../../../src/database/prisma.service.js';
import { NotificationsService } from '../../../src/modules/notifications/notifications.service.js';

const mockNotificationsService = {
  createNotification: jest.fn().mockResolvedValue({ id: 'notif-1' }),
};

const mockPrisma = {
  groupSession: {
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  groupEnrollment: {
    create: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
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

const mockSession = {
  id: 'session-1',
  nameAr: 'جلسة علاج',
  nameEn: 'Therapy Session',
  practitionerId: 'practitioner-1',
  status: 'open' as const,
  schedulingMode: 'fixed_date' as const,
  currentEnrollment: 0,
  minParticipants: 3,
  maxParticipants: 5,
  pricePerPersonHalalat: 100,
  paymentDeadlineHours: 48,
  deletedAt: null,
};

describe('GroupSessionsEnrollmentsService', () => {
  let service: GroupSessionsEnrollmentsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GroupSessionsEnrollmentsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: NotificationsService, useValue: mockNotificationsService },
      ],
    }).compile();

    service = module.get<GroupSessionsEnrollmentsService>(GroupSessionsEnrollmentsService);
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
  // ENROLL
  // ─────────────────────────────────────────────────────────────

  describe('enroll', () => {
    it('should enroll a patient and increment currentEnrollment', async () => {
      mockPrisma.groupSession.findFirst.mockResolvedValue(mockSession);
      mockPrisma.groupEnrollment.findFirst.mockResolvedValue(null);
      mockPrisma.groupEnrollment.create.mockResolvedValue({
        id: 'enr-1',
        groupSessionId: 'session-1',
        patientId: 'patient-1',
        status: 'registered',
      });

      const result = await service.enroll('session-1', 'patient-1');

      expect(result).toEqual({
        id: 'enr-1',
        groupSessionId: 'session-1',
        patientId: 'patient-1',
        status: 'registered',
      });
      expect(mockPrisma.groupEnrollment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            groupSessionId: 'session-1',
            patientId: 'patient-1',
            status: 'registered',
          }),
        }),
      );
    });

    it('should set enrollment status to confirmed for free sessions', async () => {
      const freeSession = { ...mockSession, pricePerPersonHalalat: 0 };
      mockPrisma.groupSession.findFirst.mockResolvedValue(freeSession);
      mockPrisma.groupEnrollment.findFirst.mockResolvedValue(null);
      mockPrisma.groupEnrollment.create.mockResolvedValue({
        id: 'enr-1',
        groupSessionId: 'session-1',
        patientId: 'patient-1',
        status: 'confirmed',
      });

      await service.enroll('session-1', 'patient-1');

      expect(mockPrisma.groupEnrollment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'confirmed' }),
        }),
      );
    });

    it('should throw NotFoundException for non-existent session', async () => {
      mockPrisma.groupSession.findFirst.mockResolvedValue(null);

      await expect(service.enroll('non-existent', 'patient-1')).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if session status is full', async () => {
      mockPrisma.groupSession.findFirst.mockResolvedValue({ ...mockSession, status: 'full' });

      await expect(service.enroll('session-1', 'patient-1')).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if session status is completed', async () => {
      mockPrisma.groupSession.findFirst.mockResolvedValue({ ...mockSession, status: 'completed' });

      await expect(service.enroll('session-1', 'patient-1')).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if session status is cancelled', async () => {
      mockPrisma.groupSession.findFirst.mockResolvedValue({ ...mockSession, status: 'cancelled' });

      await expect(service.enroll('session-1', 'patient-1')).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if patient is already enrolled (active)', async () => {
      mockPrisma.groupSession.findFirst.mockResolvedValue(mockSession);
      mockPrisma.groupEnrollment.findFirst.mockResolvedValue({
        id: 'existing-enr',
        status: 'registered',
      });

      await expect(service.enroll('session-1', 'patient-1')).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if patient has confirmed enrollment', async () => {
      mockPrisma.groupSession.findFirst.mockResolvedValue(mockSession);
      mockPrisma.groupEnrollment.findFirst.mockResolvedValue({
        id: 'existing-enr',
        status: 'confirmed',
      });

      await expect(service.enroll('session-1', 'patient-1')).rejects.toThrow(BadRequestException);
    });

    it('should allow re-enrollment if previous enrollment was cancelled', async () => {
      mockPrisma.groupSession.findFirst.mockResolvedValue(mockSession);
      mockPrisma.groupEnrollment.findFirst.mockResolvedValue(null);
      mockPrisma.groupEnrollment.create.mockResolvedValue({
        id: 'enr-new',
        groupSessionId: 'session-1',
        patientId: 'patient-1',
        status: 'registered',
      });

      const result = await service.enroll('session-1', 'patient-1');

      expect(result.id).toBe('enr-new');
    });

    it('should allow re-enrollment if previous enrollment was expired', async () => {
      mockPrisma.groupSession.findFirst.mockResolvedValue(mockSession);
      mockPrisma.groupEnrollment.findFirst.mockResolvedValue(null);
      mockPrisma.groupEnrollment.create.mockResolvedValue({
        id: 'enr-new',
        groupSessionId: 'session-1',
        patientId: 'patient-1',
        status: 'registered',
      });

      const result = await service.enroll('session-1', 'patient-1');

      expect(result.id).toBe('enr-new');
    });

    it('should change session status to full when maxParticipants reached', async () => {
      const almostFullSession = { ...mockSession, currentEnrollment: 4, maxParticipants: 5 };
      mockPrisma.groupSession.findFirst.mockResolvedValue(almostFullSession);
      mockPrisma.groupEnrollment.findFirst.mockResolvedValue(null);
      mockPrisma.groupEnrollment.create.mockResolvedValue({
        id: 'enr-5',
        groupSessionId: 'session-1',
        patientId: 'patient-5',
        status: 'registered',
      });

      await service.enroll('session-1', 'patient-5');

      expect(mockPrisma.groupSession.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'full', currentEnrollment: 5 }),
        }),
      );
    });

    it('should change session status to confirmed when minParticipants reached (fixed_date)', async () => {
      const growingSession = {
        ...mockSession,
        schedulingMode: 'fixed_date',
        currentEnrollment: 2,
        minParticipants: 3,
        maxParticipants: 10,
        status: 'open',
      };
      mockPrisma.groupSession.findFirst.mockResolvedValue(growingSession);
      mockPrisma.groupEnrollment.findFirst.mockResolvedValue(null);
      mockPrisma.groupEnrollment.create.mockResolvedValue({
        id: 'enr-3',
        groupSessionId: 'session-1',
        patientId: 'patient-3',
        status: 'registered',
      });
      mockPrisma.groupEnrollment.findMany.mockResolvedValue([]);

      await service.enroll('session-1', 'patient-3');

      expect(mockPrisma.groupSession.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'confirmed' }),
        }),
      );
    });

    it('should NOT change status to confirmed for on_capacity when min reached', async () => {
      const onCapacitySession = {
        ...mockSession,
        schedulingMode: 'on_capacity',
        currentEnrollment: 2,
        minParticipants: 3,
        maxParticipants: 10,
        status: 'open',
      };
      mockPrisma.groupSession.findFirst.mockResolvedValue(onCapacitySession);
      mockPrisma.groupEnrollment.findFirst.mockResolvedValue(null);
      mockPrisma.groupEnrollment.create.mockResolvedValue({
        id: 'enr-3',
        groupSessionId: 'session-1',
        patientId: 'patient-3',
        status: 'registered',
      });

      await service.enroll('session-1', 'patient-3');

      expect(mockPrisma.groupSession.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'open' }),
        }),
      );
    });

    it('should send enrollment notification to patient', async () => {
      mockPrisma.groupSession.findFirst.mockResolvedValue(mockSession);
      mockPrisma.groupEnrollment.findFirst.mockResolvedValue(null);
      mockPrisma.groupEnrollment.create.mockResolvedValue({
        id: 'enr-1',
        groupSessionId: 'session-1',
        patientId: 'patient-1',
        status: 'registered',
      });

      await service.enroll('session-1', 'patient-1');

      expect(mockNotificationsService.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'patient-1',
          type: 'group_enrollment_created',
        }),
      );
    });

    it('should send payment confirmation body for free sessions', async () => {
      const freeSession = { ...mockSession, pricePerPersonHalalat: 0 };
      mockPrisma.groupSession.findFirst.mockResolvedValue(freeSession);
      mockPrisma.groupEnrollment.findFirst.mockResolvedValue(null);
      mockPrisma.groupEnrollment.create.mockResolvedValue({
        id: 'enr-1',
        groupSessionId: 'session-1',
        patientId: 'patient-1',
        status: 'confirmed',
      });

      await service.enroll('session-1', 'patient-1');

      expect(mockNotificationsService.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          bodyEn: expect.stringContaining('confirmed'),
        }),
      );
    });

    it('should send "await payment" body for paid sessions', async () => {
      mockPrisma.groupSession.findFirst.mockResolvedValue(mockSession);
      mockPrisma.groupEnrollment.findFirst.mockResolvedValue(null);
      mockPrisma.groupEnrollment.create.mockResolvedValue({
        id: 'enr-1',
        groupSessionId: 'session-1',
        patientId: 'patient-1',
        status: 'registered',
      });

      await service.enroll('session-1', 'patient-1');

      expect(mockNotificationsService.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          bodyEn: expect.stringContaining('notify you'),
        }),
      );
    });

    it('should send practitioner notification when on_capacity min reached first time', async () => {
      const onCapacitySession = {
        ...mockSession,
        schedulingMode: 'on_capacity',
        currentEnrollment: 2,
        minParticipants: 3,
        maxParticipants: 10,
        status: 'open',
        practitionerId: 'practitioner-1',
      };
      mockPrisma.groupSession.findFirst.mockResolvedValue(onCapacitySession);
      mockPrisma.groupEnrollment.findFirst.mockResolvedValue(null);
      mockPrisma.groupEnrollment.create.mockResolvedValue({
        id: 'enr-3',
        groupSessionId: 'session-1',
        patientId: 'patient-3',
        status: 'registered',
      });

      await service.enroll('session-1', 'patient-3');

      expect(mockNotificationsService.createNotification).toHaveBeenCalledTimes(2);
      expect(mockNotificationsService.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'practitioner-1',
          type: 'group_capacity_reached',
        }),
      );
    });

    it('should NOT send practitioner notification if min was already reached before', async () => {
      const onCapacitySession = {
        ...mockSession,
        schedulingMode: 'on_capacity',
        currentEnrollment: 4,
        minParticipants: 3,
        maxParticipants: 10,
        status: 'open',
        practitionerId: 'practitioner-1',
      };
      mockPrisma.groupSession.findFirst.mockResolvedValue(onCapacitySession);
      mockPrisma.groupEnrollment.findFirst.mockResolvedValue(null);
      mockPrisma.groupEnrollment.create.mockResolvedValue({
        id: 'enr-5',
        groupSessionId: 'session-1',
        patientId: 'patient-5',
        status: 'registered',
      });

      await service.enroll('session-1', 'patient-5');

      expect(mockNotificationsService.createNotification).toHaveBeenCalledTimes(1);
    });

    it('should trigger notifySessionConfirmed when fixed_date hits min for paid session', async () => {
      const growingSession = {
        ...mockSession,
        schedulingMode: 'fixed_date',
        currentEnrollment: 2,
        minParticipants: 3,
        maxParticipants: 10,
        status: 'open',
        paymentDeadlineHours: 48,
      };
      mockPrisma.groupSession.findFirst.mockResolvedValue(growingSession);
      mockPrisma.groupEnrollment.findFirst.mockResolvedValue(null);
      mockPrisma.groupEnrollment.create.mockResolvedValue({
        id: 'enr-3',
        groupSessionId: 'session-1',
        patientId: 'patient-3',
        status: 'registered',
      });
      mockPrisma.groupEnrollment.findMany.mockResolvedValue([
        { id: 'enr-1', patientId: 'patient-1' },
        { id: 'enr-2', patientId: 'patient-2' },
        { id: 'enr-3', patientId: 'patient-3' },
      ]);

      await service.enroll('session-1', 'patient-3');

      expect(mockNotificationsService.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'group_session_confirmed',
        }),
      );
    });

    it('should not throw when enrollment notification fails', async () => {
      mockPrisma.groupSession.findFirst.mockResolvedValue(mockSession);
      mockPrisma.groupEnrollment.findFirst.mockResolvedValue(null);
      mockPrisma.groupEnrollment.create.mockResolvedValue({
        id: 'enr-1',
        groupSessionId: 'session-1',
        patientId: 'patient-1',
        status: 'registered',
      });
      mockNotificationsService.createNotification.mockRejectedValueOnce(new Error('Push failed'));

      const result = await service.enroll('session-1', 'patient-1');
      expect(result.id).toBe('enr-1');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // CANCEL ENROLLMENT (patient-initiated)
  // ─────────────────────────────────────────────────────────────

  describe('cancelEnrollment', () => {
    it('should cancel a registered enrollment and decrement count', async () => {
      const enrollment = {
        id: 'enr-1',
        groupSessionId: 'session-1',
        patientId: 'patient-1',
        status: 'registered',
      };
      mockPrisma.groupEnrollment.findFirst.mockResolvedValue(enrollment);
      mockPrisma.groupSession.findFirst.mockResolvedValue({
        ...mockSession,
        currentEnrollment: 3,
        status: 'confirmed',
      });

      const result = await service.cancelEnrollment('enr-1', 'patient-1');

      expect(result).toEqual({ cancelled: true });
      expect(mockPrisma.groupEnrollment.update).toHaveBeenCalledWith({
        where: { id: 'enr-1' },
        data: { status: 'cancelled' },
      });
    });

    it('should revert session status to open when enrollment drops below minParticipants', async () => {
      const enrollment = {
        id: 'enr-1',
        groupSessionId: 'session-1',
        patientId: 'patient-1',
        status: 'registered',
      };
      mockPrisma.groupEnrollment.findFirst.mockResolvedValue(enrollment);
      mockPrisma.groupSession.findFirst.mockResolvedValue({
        ...mockSession,
        currentEnrollment: 3,
        minParticipants: 3,
        status: 'confirmed',
      });

      await service.cancelEnrollment('enr-1', 'patient-1');

      expect(mockPrisma.groupSession.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'open', currentEnrollment: 2 }),
        }),
      );
    });

    it('should revert session status from full to confirmed when slot freed', async () => {
      const enrollment = {
        id: 'enr-1',
        groupSessionId: 'session-1',
        patientId: 'patient-1',
        status: 'registered',
      };
      mockPrisma.groupEnrollment.findFirst.mockResolvedValue(enrollment);
      mockPrisma.groupSession.findFirst.mockResolvedValue({
        ...mockSession,
        currentEnrollment: 5,
        maxParticipants: 5,
        minParticipants: 3,
        status: 'full',
      });

      await service.cancelEnrollment('enr-1', 'patient-1');

      expect(mockPrisma.groupSession.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'confirmed', currentEnrollment: 4 }),
        }),
      );
    });

    it('should throw NotFoundException if enrollment not found', async () => {
      mockPrisma.groupEnrollment.findFirst.mockResolvedValue(null);

      await expect(
        service.cancelEnrollment('non-existent', 'patient-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if enrollment status is confirmed (already paid)', async () => {
      mockPrisma.groupEnrollment.findFirst.mockResolvedValue({
        id: 'enr-1',
        status: 'confirmed',
      });

      await expect(
        service.cancelEnrollment('enr-1', 'patient-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for attended enrollment', async () => {
      mockPrisma.groupEnrollment.findFirst.mockResolvedValue({
        id: 'enr-1',
        status: 'attended',
      });

      await expect(
        service.cancelEnrollment('enr-1', 'patient-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for already cancelled enrollment', async () => {
      mockPrisma.groupEnrollment.findFirst.mockResolvedValue({
        id: 'enr-1',
        status: 'cancelled',
      });

      await expect(
        service.cancelEnrollment('enr-1', 'patient-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // REMOVE ENROLLMENT (admin-initiated)
  // ─────────────────────────────────────────────────────────────

  describe('removeEnrollment', () => {
    it('should remove a registered enrollment via cancelEnrollment', async () => {
      const enrollment = {
        id: 'enr-1',
        groupSessionId: 'session-1',
        patientId: 'patient-1',
        status: 'registered',
      };
      mockPrisma.groupEnrollment.findFirst.mockResolvedValue(enrollment);
      mockPrisma.groupSession.findFirst.mockResolvedValue({
        ...mockSession,
        currentEnrollment: 1,
      });

      const result = await service.removeEnrollment('enr-1');

      expect(result).toEqual({ cancelled: true });
    });

    it('should throw NotFoundException if enrollment not found', async () => {
      mockPrisma.groupEnrollment.findFirst.mockResolvedValue(null);

      await expect(service.removeEnrollment('non-existent')).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for confirmed (paid) enrollment', async () => {
      mockPrisma.groupEnrollment.findFirst.mockResolvedValue({
        id: 'enr-1',
        status: 'confirmed',
        patientId: 'patient-1',
      });

      await expect(service.removeEnrollment('enr-1')).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for attended enrollment', async () => {
      mockPrisma.groupEnrollment.findFirst.mockResolvedValue({
        id: 'enr-1',
        status: 'attended',
        patientId: 'patient-1',
      });

      await expect(service.removeEnrollment('enr-1')).rejects.toThrow(BadRequestException);
    });

    it('should reject expired enrollment via cancelEnrollment status check', async () => {
      const enrollment = {
        id: 'enr-1',
        groupSessionId: 'session-1',
        patientId: 'patient-1',
        status: 'expired',
      };
      mockPrisma.groupEnrollment.findFirst.mockResolvedValue(enrollment);

      await expect(service.removeEnrollment('enr-1')).rejects.toThrow(BadRequestException);
    });
  });
});
