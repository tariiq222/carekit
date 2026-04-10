/**
 * GroupsService Unit Tests
 */
import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { mockDeep, type DeepMockProxy } from 'jest-mock-extended';
import type { PrismaClient } from '@prisma/client';
import { GroupsService } from '../../../src/modules/groups/groups.service.js';
import { GroupsPaymentService } from '../../../src/modules/groups/groups-payment.service.js';
import { GroupsLifecycleService } from '../../../src/modules/groups/groups-lifecycle.service.js';
import { PrismaService } from '../../../src/database/prisma.service.js';
import { NotificationsService } from '../../../src/modules/notifications/notifications.service.js';
import type { CreateGroupDto } from '../../../src/modules/groups/dto/create-group.dto.js';
import type { ConfirmScheduleDto } from '../../../src/modules/groups/dto/confirm-schedule.dto.js';

const baseGroup = {
  id: 'grp-1',
  nameAr: 'جلسة اختبار',
  nameEn: 'Test Group',
  descriptionAr: null,
  descriptionEn: null,
  practitionerId: 'prac-1',
  minParticipants: 3,
  maxParticipants: 10,
  pricePerPersonHalalat: 5000,
  durationMinutes: 60,
  paymentDeadlineHours: 48,
  paymentType: 'FULL_PAYMENT' as const,
  depositAmount: null,
  remainingDueDate: null,
  schedulingMode: 'fixed_date' as const,
  startTime: new Date(Date.now() + 86400000),
  endTime: new Date(Date.now() + 86400000 + 3600000),
  endDate: null,
  deliveryMode: 'in_person' as const,
  location: null,
  meetingLink: null,
  status: 'open' as const,
  currentEnrollment: 5,
  reminderSent: false,
  isPublished: true,
  expiresAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  practitioner: { id: 'prac-1', nameAr: 'د. علي' },
  enrollments: [] as Array<{ id: string; patientId: string; status: string; payment?: { id: string; status: string } }>,
};

const mockPrisma: DeepMockProxy<PrismaClient> = mockDeep<PrismaClient>();

const mockNotifications: jest.Mocked<Pick<NotificationsService, 'createNotification'>> = {
  createNotification: jest.fn().mockResolvedValue(undefined),
};

const mockActivityLog: jest.Mocked<Pick<import('../../../src/modules/activity-log/activity-log.service.js').ActivityLogService, 'log'>> = {
  log: jest.fn().mockResolvedValue(undefined),
};

mockPrisma.$transaction.mockImplementation(async (fn: (tx: PrismaClient) => Promise<unknown>) => fn(mockPrisma as unknown as PrismaClient));

describe('GroupsService', () => {
  let service: GroupsService;
  let paymentService: GroupsPaymentService;
  let lifecycleService: GroupsLifecycleService;

  beforeEach(async () => {
    jest.clearAllMocks();

    paymentService = new GroupsPaymentService(
      mockPrisma as unknown as import('../../../src/database/prisma.service.js').PrismaService,
      mockNotifications as unknown as NotificationsService,
      mockActivityLog as unknown as import('../../../src/modules/activity-log/activity-log.service.js').ActivityLogService,
    );

    lifecycleService = new GroupsLifecycleService(
      mockPrisma as unknown as import('../../../src/database/prisma.service.js').PrismaService,
      mockNotifications as unknown as NotificationsService,
      mockActivityLog as unknown as import('../../../src/modules/activity-log/activity-log.service.js').ActivityLogService,
    );

    const module = await Test.createTestingModule({
      providers: [
        GroupsService,
        { provide: GroupsPaymentService, useValue: paymentService },
        { provide: GroupsLifecycleService, useValue: lifecycleService },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get(GroupsService);
  });

  // ─── create() ───────────────────────────────────────────────────

  describe('create()', () => {
    const validDto: CreateGroupDto = {
      nameAr: 'جلسة جماعية',
      nameEn: 'Group Session',
      practitionerId: 'prac-1',
      minParticipants: 2,
      maxParticipants: 10,
      pricePerPersonHalalat: 5000,
      durationMinutes: 60,
      paymentType: 'FULL_PAYMENT',
      schedulingMode: 'on_capacity',
      deliveryMode: 'in_person',
    };

    it('throws 400 when minParticipants > maxParticipants', async () => {
      await expect(service.create({ ...validDto, minParticipants: 10, maxParticipants: 5 }))
        .rejects.toThrow(BadRequestException);
    });

    it('throws 400 when fixed_date with no startTime', async () => {
      await expect(service.create({ ...validDto, schedulingMode: 'fixed_date', startTime: undefined }))
        .rejects.toThrow(BadRequestException);
    });

    it('throws 400 when DEPOSIT paymentType with no depositAmount', async () => {
      await expect(service.create({ ...validDto, paymentType: 'DEPOSIT', depositAmount: undefined }))
        .rejects.toThrow(BadRequestException);
    });

    it('throws 400 when startTime is in the past', async () => {
      await expect(service.create({
        ...validDto,
        schedulingMode: 'fixed_date',
        startTime: new Date(Date.now() - 3600000).toISOString(),
      })).rejects.toThrow(BadRequestException);
    });

    it('creates group successfully for on_capacity mode', async () => {
      mockPrisma.group.create.mockResolvedValue(baseGroup as never);
      const result = await service.create(validDto);
      expect(result.nameEn).toBe('Test Group');
      expect(mockPrisma.group.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ paymentType: 'FULL_PAYMENT' }),
        }),
      );
    });

    it('should save remainingDueDate when paymentType is DEPOSIT', async () => {
      const dto = {
        nameAr: 'مجموعة',
        nameEn: 'Group',
        practitionerId: 'p-1',
        minParticipants: 2,
        maxParticipants: 10,
        pricePerPersonHalalat: 10000,
        durationMinutes: 60,
        paymentType: 'DEPOSIT' as const,
        depositAmount: 3000,
        remainingDueDate: '2026-05-01T00:00:00.000Z',
        schedulingMode: 'fixed_date' as const,
        startTime: '2026-05-10T10:00:00.000Z',
        deliveryMode: 'in_person' as const,
      };

      mockPrisma.group.create.mockResolvedValue({ id: 'group-new', ...dto } as never);

      await service.create(dto);

      expect(mockPrisma.group.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            remainingDueDate: new Date('2026-05-01T00:00:00.000Z'),
          }),
        }),
      );
    });
  });

  // ─── findOne() ──────────────────────────────────────────────────

  describe('findOne()', () => {
    it('throws 404 when group not found', async () => {
      mockPrisma.group.findFirst.mockResolvedValue(null);
      await expect(service.findOne('nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('returns group when found', async () => {
      mockPrisma.group.findFirst.mockResolvedValue(baseGroup as never);
      const result = await service.findOne('grp-1');
      expect(result.id).toBe('grp-1');
    });
  });

  // ─── getRequiredAmount() — via triggerPaymentRequest() ──────────

  describe('triggerPaymentRequest() — payment amount logic', () => {
    beforeEach(() => {
      mockPrisma.groupEnrollment.findMany.mockResolvedValue([{ id: 'enr-1', patientId: 'pat-1' }]);
      mockPrisma.groupEnrollment.updateMany.mockResolvedValue({ count: 1 } as never);
      mockPrisma.group.update.mockResolvedValue(baseGroup as never);
    });

    it('sends 0 for FREE_HOLD groups', async () => {
      mockPrisma.group.findFirst.mockResolvedValue({ ...baseGroup, paymentType: 'FREE_HOLD', status: 'open', currentEnrollment: 5 } as never);
      await service.triggerPaymentRequest('grp-1');
      expect(mockNotifications.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({ bodyEn: expect.stringContaining('0 halalat') }),
      );
    });

    it('sends depositAmount for DEPOSIT groups', async () => {
      mockPrisma.group.findFirst.mockResolvedValue({ ...baseGroup, paymentType: 'DEPOSIT', depositAmount: 1000, status: 'open', currentEnrollment: 5 } as never);
      await service.triggerPaymentRequest('grp-1');
      expect(mockNotifications.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({ bodyEn: expect.stringContaining('1000 halalat') }),
      );
    });

    it('sends full price for FULL_PAYMENT groups', async () => {
      mockPrisma.group.findFirst.mockResolvedValue(baseGroup as never);
      await service.triggerPaymentRequest('grp-1');
      expect(mockNotifications.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({ bodyEn: expect.stringContaining('5000 halalat') }),
      );
    });

    it('throws 400 when minimum participants not met', async () => {
      mockPrisma.group.findFirst.mockResolvedValue({ ...baseGroup, currentEnrollment: 2, minParticipants: 3, status: 'open' } as never);
      await expect(service.triggerPaymentRequest('grp-1')).rejects.toThrow(BadRequestException);
    });

    it('throws 400 when group is not open or full', async () => {
      mockPrisma.group.findFirst.mockResolvedValue({ ...baseGroup, status: 'cancelled' } as never);
      await expect(service.triggerPaymentRequest('grp-1')).rejects.toThrow(BadRequestException);
    });
  });

  // ─── complete() ─────────────────────────────────────────────────

  describe('complete()', () => {
    it('throws 400 when group is not confirmed or full', async () => {
      mockPrisma.group.findFirst.mockResolvedValue({ ...baseGroup, status: 'open' } as never);
      await expect(service.complete('grp-1', [])).rejects.toThrow(BadRequestException);
    });

    it('completes group with empty attended list — skips updateMany', async () => {
      mockPrisma.group.findFirst.mockResolvedValue({ ...baseGroup, status: 'confirmed' } as never);
      mockPrisma.group.update.mockResolvedValue({ ...baseGroup, status: 'completed' } as never);

      const result = await service.complete('grp-1', []);
      expect(result).toEqual({ completed: true });
      expect(mockPrisma.groupEnrollment.updateMany).not.toHaveBeenCalled();
    });

    it('marks attended patients on complete', async () => {
      mockPrisma.group.findFirst.mockResolvedValue({ ...baseGroup, status: 'confirmed' } as never);
      mockPrisma.group.update.mockResolvedValue({ ...baseGroup, status: 'completed' } as never);
      mockPrisma.groupEnrollment.updateMany.mockResolvedValue({ count: 2 } as never);

      await service.complete('grp-1', ['pat-1', 'pat-2']);
      expect(mockPrisma.groupEnrollment.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'attended', attended: true }) }),
      );
    });
  });

  // ─── confirmSchedule() ──────────────────────────────────────────

  describe('confirmSchedule()', () => {
    const dto: ConfirmScheduleDto = { startTime: new Date(Date.now() + 86400000).toISOString() };

    it('throws 400 when group is not awaiting_payment', async () => {
      mockPrisma.group.findFirst.mockResolvedValue({ ...baseGroup, status: 'open' } as never);
      await expect(service.confirmSchedule('grp-1', dto)).rejects.toThrow(BadRequestException);
    });

    it('throws 400 when startTime is in the past', async () => {
      mockPrisma.group.findFirst.mockResolvedValue({ ...baseGroup, status: 'awaiting_payment' } as never);
      await expect(service.confirmSchedule('grp-1', { startTime: new Date(Date.now() - 1000).toISOString() }))
        .rejects.toThrow(BadRequestException);
    });

    it('throws 400 when no confirmed (paid) enrollments exist', async () => {
      mockPrisma.group.findFirst.mockResolvedValue({ ...baseGroup, status: 'awaiting_payment' } as never);
      mockPrisma.groupEnrollment.findMany.mockResolvedValue([]);
      await expect(service.confirmSchedule('grp-1', dto)).rejects.toThrow(BadRequestException);
    });

    it('sets status to confirmed and sends notifications', async () => {
      mockPrisma.group.findFirst.mockResolvedValue({ ...baseGroup, status: 'awaiting_payment' } as never);
      mockPrisma.groupEnrollment.findMany.mockResolvedValue([{ id: 'enr-1', patientId: 'pat-1' }]);
      mockPrisma.group.update.mockResolvedValue({ ...baseGroup, status: 'confirmed' } as never);

      const result = await service.confirmSchedule('grp-1', dto);
      expect(result.status).toBe('confirmed');
      expect(mockNotifications.createNotification).toHaveBeenCalledTimes(1);
    });
  });

  // ─── cancel() ─────────────────────────────────────────────────

  describe('cancel()', () => {
    const groupId = 'grp-1';

    it('throws 404 when group not found', async () => {
      mockPrisma.group.findFirst.mockResolvedValue(null);
      await expect(service.cancel(groupId)).rejects.toThrow(NotFoundException);
    });

    it('throws 400 when group already cancelled', async () => {
      mockPrisma.group.findFirst.mockResolvedValue({ ...baseGroup, status: 'cancelled' } as never);
      await expect(service.cancel(groupId)).rejects.toThrow(BadRequestException);
    });

    it('cancels successfully and updates enrollment statuses', async () => {
      const group = { ...baseGroup, id: groupId, status: 'open', enrollments: [] } as never;
      mockPrisma.group.findFirst.mockResolvedValue(group);
      mockPrisma.groupEnrollment.updateMany.mockResolvedValue({ count: 2 } as never);
      mockPrisma.group.update.mockResolvedValue({ ...baseGroup, id: groupId, status: 'cancelled' } as never);

      const result = await service.cancel(groupId);
      expect(result).toEqual({ cancelled: true });
    });
  });

  // ─── resendPaymentRequest() ───────────────────────────────────

  describe('resendPaymentRequest()', () => {
    it('throws 404 when enrollment not found', async () => {
      mockPrisma.groupEnrollment.findFirst.mockResolvedValue(null);
      await expect(service.resendPaymentRequest('grp-1', 'non-existent')).rejects.toThrow(NotFoundException);
    });

    it('resends notification successfully', async () => {
      const enrollment = {
        id: 'enr-1',
        groupId: 'grp-1',
        patientId: 'pat-1',
        status: 'payment_requested',
        paymentDeadlineAt: new Date(),
        group: { pricePerPersonHalalat: 5000, depositAmount: null, paymentType: 'FULL_PAYMENT', paymentDeadlineHours: 48 },
      } as never;
      mockPrisma.groupEnrollment.findFirst.mockResolvedValue(enrollment);

      await expect(service.resendPaymentRequest('grp-1', 'enr-1')).resolves.toEqual({ resent: true });
      expect(mockNotifications.createNotification).toHaveBeenCalledTimes(1);
    });
  });
});
