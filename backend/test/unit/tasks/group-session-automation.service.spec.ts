/**
 * GroupAutomationService Unit Tests
 */
import { Test, TestingModule } from '@nestjs/testing';
import { GroupAutomationService } from '../../../src/modules/tasks/group-session-automation.service.js';
import { PrismaService } from '../../../src/database/prisma.service.js';
import { NotificationsService } from '../../../src/modules/notifications/notifications.service.js';

const makeGroup = (overrides = {}) => ({
  id: 'group-1',
  nameAr: 'جلسة تجريبية',
  nameEn: 'Test Session',
  currentEnrollment: 3,
  minParticipants: 2,
  maxParticipants: 5,
  status: 'confirmed',
  ...overrides,
});

const makeEnrollment = (overrides = {}) => ({
  id: 'enrollment-1',
  patientId: 'patient-1',
  groupId: 'group-1',
  group: makeGroup(),
  ...overrides,
});

const mockTx: any = {
  groupEnrollment: {
    findFirst: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  group: { update: jest.fn() },
};

const mockPrisma: any = {
  groupEnrollment: { findMany: jest.fn() },
  group: { findMany: jest.fn(), update: jest.fn() },
  $transaction: jest.fn((fn: (tx: typeof mockTx) => Promise<unknown>) =>
    fn(mockTx),
  ),
};

const mockNotifications: any = {
  createNotification: jest.fn().mockResolvedValue(undefined),
};

describe('GroupAutomationService', () => {
  let service: GroupAutomationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GroupAutomationService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: NotificationsService, useValue: mockNotifications },
      ],
    }).compile();

    service = module.get<GroupAutomationService>(GroupAutomationService);
    jest.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(
      (fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx),
    );
    mockTx.groupEnrollment.findFirst.mockResolvedValue(makeEnrollment());
    mockTx.groupEnrollment.update.mockResolvedValue({});
    mockTx.groupEnrollment.updateMany.mockResolvedValue({ count: 1 });
    mockTx.group.update.mockResolvedValue({});
    mockPrisma.group.update.mockResolvedValue({});
    mockNotifications.createNotification.mockResolvedValue(undefined);
  });

  // ─── expireUnpaidEnrollments ─────────────────────────────────────────────

  describe('expireUnpaidEnrollments', () => {
    it('does nothing when no expired enrollments', async () => {
      mockPrisma.groupEnrollment.findMany.mockResolvedValue([]);

      await service.expireUnpaidEnrollments();

      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
      expect(mockNotifications.createNotification).not.toHaveBeenCalled();
    });

    it('expires enrollment and decrements group count', async () => {
      const enrollment = makeEnrollment({
        group: makeGroup({ currentEnrollment: 3 }),
      });
      mockPrisma.groupEnrollment.findMany.mockResolvedValue([enrollment]);

      await service.expireUnpaidEnrollments();

      expect(mockTx.groupEnrollment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: enrollment.id },
          data: expect.objectContaining({ status: 'expired' }),
        }),
      );
      expect(mockTx.group.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ currentEnrollment: 2 }),
        }),
      );
    });

    it('sends expiry notification to patient', async () => {
      const enrollment = makeEnrollment();
      mockPrisma.groupEnrollment.findMany.mockResolvedValue([enrollment]);

      await service.expireUnpaidEnrollments();

      expect(mockNotifications.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: enrollment.patientId,
          type: 'group_enrollment_expired',
        }),
      );
    });

    it('sets group status to open when count drops below minParticipants', async () => {
      const enrollment = makeEnrollment({
        group: makeGroup({
          currentEnrollment: 2,
          minParticipants: 2,
          status: 'confirmed',
        }),
      });
      mockPrisma.groupEnrollment.findMany.mockResolvedValue([enrollment]);

      await service.expireUnpaidEnrollments();

      expect(mockTx.group.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'open',
            currentEnrollment: 1,
          }),
        }),
      );
    });

    it('sets group status to confirmed when count drops below maxParticipants from full', async () => {
      const enrollment = makeEnrollment({
        group: makeGroup({
          currentEnrollment: 5,
          maxParticipants: 5,
          minParticipants: 2,
          status: 'full',
        }),
      });
      mockPrisma.groupEnrollment.findMany.mockResolvedValue([enrollment]);

      await service.expireUnpaidEnrollments();

      expect(mockTx.group.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'confirmed',
            currentEnrollment: 4,
          }),
        }),
      );
    });

    it('skips enrollment if already progressed past payment_requested inside transaction', async () => {
      const enrollment = makeEnrollment();
      mockPrisma.groupEnrollment.findMany.mockResolvedValue([enrollment]);
      mockTx.groupEnrollment.findFirst.mockResolvedValue(null); // already changed

      await service.expireUnpaidEnrollments();

      expect(mockTx.groupEnrollment.update).not.toHaveBeenCalled();
    });

    it('continues processing remaining enrollments when one transaction fails', async () => {
      const e1 = makeEnrollment({ id: 'enrollment-1', patientId: 'p1' });
      const e2 = makeEnrollment({ id: 'enrollment-2', patientId: 'p2' });
      mockPrisma.groupEnrollment.findMany.mockResolvedValue([e1, e2]);
      mockPrisma.$transaction
        .mockRejectedValueOnce(new Error('DB error'))
        .mockImplementation((fn: (tx: typeof mockTx) => Promise<unknown>) =>
          fn(mockTx),
        );

      await service.expireUnpaidEnrollments();

      // Second enrollment still processed
      expect(mockTx.groupEnrollment.update).toHaveBeenCalledTimes(1);
    });
  });

  // ─── cancelExpiredSessions ───────────────────────────────────────────────

  describe('cancelExpiredSessions', () => {
    it('does nothing when no expired groups', async () => {
      mockPrisma.group.findMany.mockResolvedValue([]);

      await service.cancelExpiredSessions();

      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
      expect(mockNotifications.createNotification).not.toHaveBeenCalled();
    });

    it('cancels group and its registered enrollments', async () => {
      const group = {
        ...makeGroup({ status: 'open' }),
        enrollments: [{ id: 'e1', patientId: 'p1' }],
      };
      mockPrisma.group.findMany.mockResolvedValue([group]);

      await service.cancelExpiredSessions();

      expect(mockTx.group.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: 'cancelled' } }),
      );
      expect(mockTx.groupEnrollment.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { groupId: group.id, status: 'registered' },
          data: { status: 'cancelled' },
        }),
      );
    });

    it('sends cancellation notification to each enrolled patient', async () => {
      const group = {
        ...makeGroup({ status: 'open' }),
        enrollments: [
          { id: 'e1', patientId: 'p1' },
          { id: 'e2', patientId: 'p2' },
        ],
      };
      mockPrisma.group.findMany.mockResolvedValue([group]);

      await service.cancelExpiredSessions();

      expect(mockNotifications.createNotification).toHaveBeenCalledTimes(2);
      expect(mockNotifications.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'p1',
          type: 'group_session_cancelled',
        }),
      );
      expect(mockNotifications.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'p2',
          type: 'group_session_cancelled',
        }),
      );
    });

    it('continues processing remaining groups when one transaction fails', async () => {
      const g1 = {
        ...makeGroup({ id: 'g1', status: 'open' }),
        enrollments: [],
      };
      const g2 = {
        ...makeGroup({ id: 'g2', status: 'open' }),
        enrollments: [],
      };
      mockPrisma.group.findMany.mockResolvedValue([g1, g2]);
      mockPrisma.$transaction
        .mockRejectedValueOnce(new Error('DB error'))
        .mockImplementation((fn: (tx: typeof mockTx) => Promise<unknown>) =>
          fn(mockTx),
        );

      await service.cancelExpiredSessions();

      expect(mockTx.group.update).toHaveBeenCalledTimes(1);
    });
  });

  // ─── sendSessionReminders ────────────────────────────────────────────────

  describe('sendSessionReminders', () => {
    it('does nothing when no upcoming sessions', async () => {
      mockPrisma.group.findMany.mockResolvedValue([]);

      await service.sendSessionReminders();

      expect(mockNotifications.createNotification).not.toHaveBeenCalled();
      expect(mockPrisma.group.update).not.toHaveBeenCalled();
    });

    it('sends reminder to every confirmed enrollment', async () => {
      const group = {
        ...makeGroup({ status: 'confirmed' }),
        enrollments: [{ patientId: 'p1' }, { patientId: 'p2' }],
      };
      mockPrisma.group.findMany.mockResolvedValue([group]);

      await service.sendSessionReminders();

      expect(mockNotifications.createNotification).toHaveBeenCalledTimes(2);
      expect(mockNotifications.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'p1',
          type: 'group_session_reminder',
        }),
      );
    });

    it('marks group reminderSent=true after sending', async () => {
      const group = { ...makeGroup(), enrollments: [{ patientId: 'p1' }] };
      mockPrisma.group.findMany.mockResolvedValue([group]);

      await service.sendSessionReminders();

      expect(mockPrisma.group.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: group.id },
          data: { reminderSent: true },
        }),
      );
    });

    it('does not send notifications for groups with no confirmed enrollments', async () => {
      const group = { ...makeGroup(), enrollments: [] };
      mockPrisma.group.findMany.mockResolvedValue([group]);

      await service.sendSessionReminders();

      expect(mockNotifications.createNotification).not.toHaveBeenCalled();
      expect(mockPrisma.group.update).toHaveBeenCalled(); // still marks reminderSent
    });
  });
});
