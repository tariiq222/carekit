/**
 * GroupsAttendanceService Unit Tests
 * Covers: confirmAttendance, bulkConfirmAttendance, issueCertificate (idempotency)
 */
import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { GroupsAttendanceService } from '../../../src/modules/groups/groups-attendance.service.js';
import { PrismaService } from '../../../src/database/prisma.service.js';
import { NotificationsService } from '../../../src/modules/notifications/notifications.service.js';
import type { ConfirmAttendanceDto } from '../../../src/modules/groups/dto/confirm-attendance.dto.js';

const baseEnrollment: any = {
  id: 'enr-1',
  groupId: 'grp-1',
  patientId: 'pat-1',
  status: 'confirmed',
  attended: false,
  attendedAt: null,
  group: { id: 'grp-1', nameAr: 'جلسة', nameEn: 'Session' },
};

const baseCertificate: any = {
  id: 'cert-1',
  enrollmentId: 'enr-1',
  groupId: 'grp-1',
  patientId: 'pat-1',
  issuedAt: new Date(),
};

const mockPrisma: any = {
  group: { findFirst: jest.fn() },
  groupEnrollment: { findFirst: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
  groupCertificate: { findUnique: jest.fn(), create: jest.fn() },
  $transaction: jest.fn(),
};

const mockNotifications: any = {
  createNotification: jest.fn().mockResolvedValue(undefined),
};

describe('GroupsAttendanceService', () => {
  let service: GroupsAttendanceService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockNotifications.createNotification.mockResolvedValue(undefined);

    const module = await Test.createTestingModule({
      providers: [
        GroupsAttendanceService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: NotificationsService, useValue: mockNotifications },
      ],
    }).compile();

    service = module.get(GroupsAttendanceService);
  });

  // ─── confirmAttendance() ─────────────────────────────────────────

  describe('confirmAttendance()', () => {
    const dto: ConfirmAttendanceDto = { enrollmentId: 'enr-1', attended: true };

    it('throws 404 when enrollment not found', async () => {
      mockPrisma.groupEnrollment.findFirst.mockResolvedValue(null);
      await expect(service.confirmAttendance(dto)).rejects.toThrow(NotFoundException);
    });

    it('throws 400 for non-confirmed/attended enrollment status', async () => {
      mockPrisma.groupEnrollment.findFirst.mockResolvedValue({ ...baseEnrollment, status: 'registered' });
      await expect(service.confirmAttendance(dto)).rejects.toThrow(BadRequestException);
    });

    it('marks attended=true and status=attended', async () => {
      mockPrisma.groupEnrollment.findFirst.mockResolvedValue(baseEnrollment);
      mockPrisma.groupEnrollment.update.mockResolvedValue({ ...baseEnrollment, attended: true, attendedAt: new Date(), status: 'attended' });

      const result = await service.confirmAttendance(dto);

      expect(mockPrisma.groupEnrollment.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ attended: true, status: 'attended' }) }),
      );
      expect(result.attended).toBe(true);
    });

    it('marks attended=false and reverts to confirmed status when previously attended', async () => {
      const attendedEnrollment = { ...baseEnrollment, status: 'attended', attended: true };
      mockPrisma.groupEnrollment.findFirst.mockResolvedValue(attendedEnrollment);
      mockPrisma.groupEnrollment.update.mockResolvedValue({ ...attendedEnrollment, attended: false, attendedAt: null, status: 'confirmed' });

      await service.confirmAttendance({ enrollmentId: 'enr-1', attended: false });

      expect(mockPrisma.groupEnrollment.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ attended: false, attendedAt: null }) }),
      );
    });
  });

  // ─── bulkConfirmAttendance() ────────────────────────────────────

  describe('bulkConfirmAttendance()', () => {
    it('throws 404 when group not found', async () => {
      mockPrisma.group.findFirst.mockResolvedValue(null);
      await expect(service.bulkConfirmAttendance('grp-x', [])).rejects.toThrow(NotFoundException);
    });

    it('marks attended=true for provided patientIds', async () => {
      mockPrisma.group.findFirst.mockResolvedValue({ id: 'grp-1', deletedAt: null });
      mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(mockPrisma));
      mockPrisma.groupEnrollment.updateMany.mockResolvedValue({ count: 2 });

      const result = await service.bulkConfirmAttendance('grp-1', ['pat-1', 'pat-2']);

      expect(result).toEqual({ markedAttended: 2 });
      expect(mockPrisma.groupEnrollment.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ attended: true, status: 'attended' }) }),
      );
    });

    it('skips attended updateMany when attendedPatientIds is empty', async () => {
      mockPrisma.group.findFirst.mockResolvedValue({ id: 'grp-1', deletedAt: null });
      mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(mockPrisma));
      mockPrisma.groupEnrollment.updateMany.mockResolvedValue({ count: 0 });

      await service.bulkConfirmAttendance('grp-1', []);

      // Only 1 call: the "mark absent" updateMany — never the "mark attended" one
      expect(mockPrisma.groupEnrollment.updateMany).toHaveBeenCalledTimes(1);
      expect(mockPrisma.groupEnrollment.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ attended: false }) }),
      );
    });
  });

  // ─── issueCertificate() ─────────────────────────────────────────

  describe('issueCertificate()', () => {
    it('throws 404 when enrollment not found', async () => {
      mockPrisma.groupEnrollment.findFirst.mockResolvedValue(null);
      await expect(service.issueCertificate('enr-x')).rejects.toThrow(NotFoundException);
    });

    it('throws 400 when enrollment has not attended', async () => {
      mockPrisma.groupEnrollment.findFirst.mockResolvedValue({ ...baseEnrollment, attended: false });
      await expect(service.issueCertificate('enr-1')).rejects.toThrow(BadRequestException);
    });

    it('creates certificate when one does not exist yet', async () => {
      mockPrisma.groupEnrollment.findFirst.mockResolvedValue({ ...baseEnrollment, attended: true });
      mockPrisma.groupCertificate.findUnique.mockResolvedValue(null);
      mockPrisma.groupCertificate.create.mockResolvedValue(baseCertificate);

      const result = await service.issueCertificate('enr-1');

      expect(mockPrisma.groupCertificate.create).toHaveBeenCalledTimes(1);
      expect(result).toMatchObject({ id: 'cert-1', enrollmentId: 'enr-1' });
    });

    it('is idempotent — returns existing certificate without creating a new one', async () => {
      mockPrisma.groupEnrollment.findFirst.mockResolvedValue({ ...baseEnrollment, attended: true });
      mockPrisma.groupCertificate.findUnique.mockResolvedValue(baseCertificate);

      const result = await service.issueCertificate('enr-1');

      expect(mockPrisma.groupCertificate.create).not.toHaveBeenCalled();
      expect(result).toMatchObject({ id: 'cert-1' });
    });

    it('fires notification after certificate creation', async () => {
      mockPrisma.groupEnrollment.findFirst.mockResolvedValue({ ...baseEnrollment, attended: true });
      mockPrisma.groupCertificate.findUnique.mockResolvedValue(null);
      mockPrisma.groupCertificate.create.mockResolvedValue(baseCertificate);

      await service.issueCertificate('enr-1');

      expect(mockNotifications.createNotification).toHaveBeenCalledTimes(1);
      expect(mockNotifications.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'pat-1', data: expect.objectContaining({ certificateId: 'cert-1' }) }),
      );
    });

    it('does NOT fire notification when certificate already exists (idempotent)', async () => {
      mockPrisma.groupEnrollment.findFirst.mockResolvedValue({ ...baseEnrollment, attended: true });
      mockPrisma.groupCertificate.findUnique.mockResolvedValue(baseCertificate);

      await service.issueCertificate('enr-1');

      expect(mockNotifications.createNotification).not.toHaveBeenCalled();
    });
  });
});
