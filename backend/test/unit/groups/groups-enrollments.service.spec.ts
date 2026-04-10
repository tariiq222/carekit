/**
 * GroupsEnrollmentsService Unit Tests
 * Includes regression tests for the awaiting_payment/confirmed enroll bug.
 */
import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { GroupsEnrollmentsService } from '../../../src/modules/groups/groups-enrollments.service.js';
import { PrismaService } from '../../../src/database/prisma.service.js';
import { NotificationsService } from '../../../src/modules/notifications/notifications.service.js';

const baseGroup: any = {
  id: 'grp-1',
  nameAr: 'جلسة اختبار',
  nameEn: 'Test Group',
  practitionerId: 'prac-1',
  minParticipants: 2,
  maxParticipants: 10,
  pricePerPersonHalalat: 5000,
  paymentDeadlineHours: 48,
  paymentType: 'FULL_PAYMENT',
  depositAmount: null,
  schedulingMode: 'on_capacity',
  status: 'open',
  currentEnrollment: 3,
  deletedAt: null,
};

const mockPrisma: any = {
  group: { findFirst: jest.fn(), update: jest.fn() },
  groupEnrollment: {
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    findMany: jest.fn(),
  },
  $transaction: jest.fn(),
};

const mockNotifications: any = {
  createNotification: jest.fn().mockResolvedValue(undefined),
};

describe('GroupsEnrollmentsService', () => {
  let service: GroupsEnrollmentsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockNotifications.createNotification.mockResolvedValue(undefined);

    const module = await Test.createTestingModule({
      providers: [
        GroupsEnrollmentsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: NotificationsService, useValue: mockNotifications },
      ],
    }).compile();

    service = module.get(GroupsEnrollmentsService);
  });

  // ─── enroll() ───────────────────────────────────────────────────

  describe('enroll()', () => {
    it('throws 404 when group not found', async () => {
      mockPrisma.group.findFirst.mockResolvedValue(null);
      await expect(service.enroll('grp-x', 'pat-1')).rejects.toThrow(NotFoundException);
    });

    it('throws 400 when enrolling in a full group', async () => {
      const blockedGroup = { ...baseGroup, status: 'full' };
      mockPrisma.group.findFirst.mockResolvedValue(blockedGroup);
      mockPrisma.groupEnrollment.findFirst.mockResolvedValue(null);
      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        const result = await fn(mockPrisma);
        return result;
      });
      await expect(service.enroll('grp-1', 'pat-1')).rejects.toThrow(BadRequestException);
    });

    it('throws 400 when enrolling in a completed group', async () => {
      const blockedGroup = { ...baseGroup, status: 'completed' };
      mockPrisma.group.findFirst.mockResolvedValue(blockedGroup);
      mockPrisma.groupEnrollment.findFirst.mockResolvedValue(null);
      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        const result = await fn(mockPrisma);
        return result;
      });
      await expect(service.enroll('grp-1', 'pat-1')).rejects.toThrow(BadRequestException);
    });

    it('throws 400 when enrolling in a cancelled group', async () => {
      const blockedGroup = { ...baseGroup, status: 'cancelled' };
      mockPrisma.group.findFirst.mockResolvedValue(blockedGroup);
      mockPrisma.groupEnrollment.findFirst.mockResolvedValue(null);
      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        const result = await fn(mockPrisma);
        return result;
      });
      await expect(service.enroll('grp-1', 'pat-1')).rejects.toThrow(BadRequestException);
    });

    // ─── regression tests for the awaiting_payment/confirmed bug ───

    it('[REGRESSION] throws 400 when enrolling in awaiting_payment group', async () => {
      const blockedGroup = { ...baseGroup, status: 'awaiting_payment' };
      mockPrisma.group.findFirst.mockResolvedValue(blockedGroup);
      mockPrisma.groupEnrollment.findFirst.mockResolvedValue(null);
      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        const result = await fn(mockPrisma);
        return result;
      });
      await expect(service.enroll('grp-1', 'pat-1')).rejects.toThrow(BadRequestException);
    });

    it('[REGRESSION] throws 400 when enrolling in confirmed group', async () => {
      const blockedGroup = { ...baseGroup, status: 'confirmed' };
      mockPrisma.group.findFirst.mockResolvedValue(blockedGroup);
      mockPrisma.groupEnrollment.findFirst.mockResolvedValue(null);
      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        const result = await fn(mockPrisma);
        return result;
      });
      await expect(service.enroll('grp-1', 'pat-1')).rejects.toThrow(BadRequestException);
    });

    // ─── end regression tests ──────────────────────────────────────

    it('throws 400 when patient is already enrolled', async () => {
      mockPrisma.group.findFirst.mockResolvedValue(baseGroup);
      mockPrisma.groupEnrollment.findFirst.mockResolvedValue({ id: 'enr-existing', status: 'registered' });
      await expect(service.enroll('grp-1', 'pat-1')).rejects.toThrow(BadRequestException);
    });

    it('creates enrollment with status=confirmed for FREE_HOLD groups', async () => {
      mockPrisma.group.findFirst.mockResolvedValue({ ...baseGroup, paymentType: 'FREE_HOLD' });
      mockPrisma.groupEnrollment.findFirst.mockResolvedValue(null);
      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        const result = await fn(mockPrisma);
        return result;
      });
      mockPrisma.groupEnrollment.create.mockResolvedValue({ id: 'enr-1', groupId: 'grp-1', patientId: 'pat-1', status: 'confirmed' });
      mockPrisma.group.update.mockResolvedValue({ ...baseGroup, currentEnrollment: 4 });

      const result = await service.enroll('grp-1', 'pat-1');

      expect(mockPrisma.groupEnrollment.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'confirmed' }) }),
      );
      expect(result.status).toBe('confirmed');
    });

    it('creates enrollment with status=registered for FULL_PAYMENT groups', async () => {
      mockPrisma.group.findFirst.mockResolvedValue(baseGroup);
      mockPrisma.groupEnrollment.findFirst.mockResolvedValue(null);
      mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(mockPrisma));
      mockPrisma.groupEnrollment.create.mockResolvedValue({ id: 'enr-1', groupId: 'grp-1', patientId: 'pat-1', status: 'registered' });
      mockPrisma.group.update.mockResolvedValue({ ...baseGroup, currentEnrollment: 4 });

      const result = await service.enroll('grp-1', 'pat-1');
      expect(result.status).toBe('registered');
    });

    it('updates group status to full when maxParticipants is reached', async () => {
      mockPrisma.group.findFirst.mockResolvedValue({ ...baseGroup, currentEnrollment: 9, maxParticipants: 10 });
      mockPrisma.groupEnrollment.findFirst.mockResolvedValue(null);
      mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(mockPrisma));
      mockPrisma.groupEnrollment.create.mockResolvedValue({ id: 'enr-1', status: 'registered' });
      mockPrisma.group.update.mockResolvedValue({ ...baseGroup, status: 'full', currentEnrollment: 10 });

      await service.enroll('grp-1', 'pat-1');

      expect(mockPrisma.group.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'full', currentEnrollment: 10 }) }),
      );
    });

    it('should not allow overbooking when two enrollments race', async () => {
      const group = {
        id: 'group-1',
        status: 'open' as const,
        paymentType: 'FULL_PAYMENT' as const,
        currentEnrollment: 9,
        maxParticipants: 10,
        minParticipants: 2,
        schedulingMode: 'fixed_date' as const,
        paymentDeadlineHours: 48,
        nameAr: 'مجموعة',
        nameEn: 'Group',
        practitionerId: 'p-1',
        deletedAt: null,
      };

      let txUpdateCallCount = 0;
      const mockTx = {
        groupEnrollment: {
          create: jest.fn().mockResolvedValue({ id: 'enroll-1', groupId: 'group-1', patientId: 'patient-1', status: 'registered' }),
          findFirst: jest.fn().mockResolvedValue(null),
        },
        group: {
          findFirst: jest.fn().mockResolvedValue({ ...group, currentEnrollment: 9 }),
          update: jest.fn().mockImplementation(({ data }: any) => {
            txUpdateCallCount++;
            expect(data.currentEnrollment).toBe(10);
            return Promise.resolve({ ...group, ...data });
          }),
        },
      };

      mockPrisma.$transaction.mockImplementation(async (fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx));
      mockPrisma.group.findFirst.mockResolvedValue(group);
      mockPrisma.groupEnrollment.findFirst.mockResolvedValue(null);

      await service.enroll('group-1', 'patient-1');

      expect(txUpdateCallCount).toBe(1);
      expect(mockTx.group.findFirst).toHaveBeenCalledWith({
        where: { id: 'group-1' },
      });
    });
  });

  // ─── cancelEnrollment() ─────────────────────────────────────────

  describe('cancelEnrollment()', () => {
    it('throws 404 when enrollment not found', async () => {
      mockPrisma.groupEnrollment.findFirst.mockResolvedValue(null);
      await expect(service.cancelEnrollment('enr-x', 'pat-1')).rejects.toThrow(NotFoundException);
    });

    it('throws 400 when enrollment is not in registered status', async () => {
      mockPrisma.groupEnrollment.findFirst.mockResolvedValue({ id: 'enr-1', patientId: 'pat-1', groupId: 'grp-1', status: 'confirmed' });
      await expect(service.cancelEnrollment('enr-1', 'pat-1')).rejects.toThrow(BadRequestException);
    });

    it('cancels registered enrollment and decrements counter', async () => {
      mockPrisma.groupEnrollment.findFirst.mockResolvedValue({ id: 'enr-1', patientId: 'pat-1', groupId: 'grp-1', status: 'registered' });
      mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(mockPrisma));
      mockPrisma.groupEnrollment.update.mockResolvedValue({ id: 'enr-1', status: 'cancelled' });
      mockPrisma.group.findFirst.mockResolvedValue(baseGroup);
      mockPrisma.group.update.mockResolvedValue(baseGroup);

      const result = await service.cancelEnrollment('enr-1', 'pat-1');
      expect(result).toEqual({ cancelled: true });
      expect(mockPrisma.groupEnrollment.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: 'cancelled' } }),
      );
    });
  });

  // ─── removeEnrollment() ─────────────────────────────────────────

  describe('removeEnrollment()', () => {
    it('throws 404 when enrollment not found', async () => {
      mockPrisma.groupEnrollment.findFirst.mockResolvedValue(null);
      await expect(service.removeEnrollment('enr-x')).rejects.toThrow(NotFoundException);
    });

    it('throws 400 when enrollment is confirmed', async () => {
      mockPrisma.groupEnrollment.findFirst.mockResolvedValue({ id: 'enr-1', patientId: 'pat-1', groupId: 'grp-1', status: 'confirmed' });
      await expect(service.removeEnrollment('enr-1')).rejects.toThrow(BadRequestException);
    });

    it('throws 400 when enrollment is attended', async () => {
      mockPrisma.groupEnrollment.findFirst.mockResolvedValue({ id: 'enr-1', patientId: 'pat-1', groupId: 'grp-1', status: 'attended' });
      await expect(service.removeEnrollment('enr-1')).rejects.toThrow(BadRequestException);
    });
  });
});
