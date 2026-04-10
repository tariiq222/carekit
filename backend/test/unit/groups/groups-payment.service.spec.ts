/**
 * GroupsPaymentService Unit Tests
 */
import { Test } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { PaymentMethod, PaymentStatus } from '@prisma/client';
import { GroupsPaymentService } from '../../../src/modules/groups/groups-payment.service.js';
import { PrismaService } from '../../../src/database/prisma.service.js';
import { NotificationsService } from '../../../src/modules/notifications/notifications.service.js';
import { ActivityLogService } from '../../../src/modules/activity-log/activity-log.service.js';

const mockPrisma: any = {
  group: { findFirst: jest.fn(), update: jest.fn() },
  groupEnrollment: { findMany: jest.fn(), updateMany: jest.fn() },
  groupPayment: { createMany: jest.fn() },
  $transaction: jest.fn(),
};

const mockNotifications: any = {
  createNotification: jest.fn().mockResolvedValue(undefined),
};

const mockActivityLog: any = {
  log: jest.fn().mockResolvedValue(undefined),
};

describe('GroupsPaymentService', () => {
  let service: GroupsPaymentService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockNotifications.createNotification.mockResolvedValue(undefined);
    mockActivityLog.log.mockResolvedValue(undefined);

    const module = await Test.createTestingModule({
      providers: [
        GroupsPaymentService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: NotificationsService, useValue: mockNotifications },
        { provide: ActivityLogService, useValue: mockActivityLog },
      ],
    }).compile();

    service = module.get(GroupsPaymentService);
  });

  describe('triggerPaymentRequest', () => {
    it('should create a GroupPayment record for each registered enrollment', async () => {
      const group = {
        id: 'group-1',
        status: 'open',
        paymentType: 'FULL_PAYMENT',
        pricePerPersonHalalat: 10000,
        depositAmount: null,
        paymentDeadlineHours: 48,
        currentEnrollment: 3,
        minParticipants: 2,
        enrollments: [],
        deletedAt: null,
      };

      const enrollments = [
        { id: 'enroll-1', patientId: 'patient-1' },
        { id: 'enroll-2', patientId: 'patient-2' },
      ];

      mockPrisma.group.findFirst.mockResolvedValue(group);
      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          group: { update: jest.fn().mockResolvedValue({}) },
          groupEnrollment: {
            findMany: jest.fn().mockResolvedValue(enrollments),
            updateMany: jest.fn().mockResolvedValue({ count: 2 }),
          },
          groupPayment: {
            createMany: jest.fn().mockResolvedValue({ count: 2 }),
          },
        };
        const result = await fn(tx);
        expect(tx.groupPayment.createMany).toHaveBeenCalledWith({
          data: enrollments.map((e) => ({
            enrollmentId: e.id,
            groupId: 'group-1',
            totalAmount: 10000,
            paidAmount: 0,
            remainingAmount: 10000,
            method: PaymentMethod.moyasar,
            status: PaymentStatus.pending,
          })),
          skipDuplicates: true,
        });
        return result;
      });

      await service.triggerPaymentRequest('group-1');
    });

    it('throws NotFoundException when group not found', async () => {
      mockPrisma.group.findFirst.mockResolvedValue(null);
      await expect(service.triggerPaymentRequest('group-x')).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when group status is not open or full', async () => {
      mockPrisma.group.findFirst.mockResolvedValue({ id: 'group-1', status: 'completed', deletedAt: null });
      await expect(service.triggerPaymentRequest('group-1')).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when currentEnrollment < minParticipants', async () => {
      mockPrisma.group.findFirst.mockResolvedValue({
        id: 'group-1', status: 'open', currentEnrollment: 1, minParticipants: 3, deletedAt: null,
      });
      await expect(service.triggerPaymentRequest('group-1')).rejects.toThrow(BadRequestException);
    });
  });
});
