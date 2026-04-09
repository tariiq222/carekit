import { Test, TestingModule } from '@nestjs/testing';
import { GroupSessionsController } from '../../../src/modules/group-sessions/group-sessions.controller.js';
import { GroupSessionsService } from '../../../src/modules/group-sessions/group-sessions.service.js';
import { GroupSessionsEnrollmentsService } from '../../../src/modules/group-sessions/group-sessions-enrollments.service.js';
import { JwtAuthGuard } from '../../../src/common/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../../../src/common/guards/permissions.guard.js';
import { FeatureFlagGuard } from '../../../src/common/guards/feature-flag.guard.js';
import { CreateGroupSessionDto } from '../../../src/modules/group-sessions/dto/create-group-session.dto.js';
import { UpdateGroupSessionDto } from '../../../src/modules/group-sessions/dto/update-group-session.dto.js';
import { GroupSessionQueryDto } from '../../../src/modules/group-sessions/dto/group-session-query.dto.js';
import { EnrollPatientDto } from '../../../src/modules/group-sessions/dto/enroll-patient.dto.js';
import { MarkAttendanceDto } from '../../../src/modules/group-sessions/dto/mark-attendance.dto.js';

const mockSessionsService = {
  create: jest.fn(),
  findAll: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
  cancel: jest.fn(),
  complete: jest.fn(),
};

const mockEnrollmentsService = {
  enroll: jest.fn(),
  removeEnrollment: jest.fn(),
};

describe('GroupSessionsController', () => {
  let controller: GroupSessionsController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GroupSessionsController],
      providers: [
        { provide: GroupSessionsService, useValue: mockSessionsService },
        { provide: GroupSessionsEnrollmentsService, useValue: mockEnrollmentsService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(FeatureFlagGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<GroupSessionsController>(GroupSessionsController);
  });

  // ─── Sessions ─────────────────────────────────────────────

  describe('create', () => {
    it('should delegate to sessionsService.create with dto', async () => {
      const dto: CreateGroupSessionDto = {
        nameAr: 'جلسة علاج',
        nameEn: 'Therapy Session',
        practitionerId: 'prac-uuid-1',
        minParticipants: 3,
        maxParticipants: 10,
        pricePerPersonHalalat: 100,
        durationMinutes: 60,
        schedulingMode: 'fixed_date',
        startTime: '2026-05-01T10:00:00.000Z',
      };
      const created = { id: 'session-1', ...dto };
      mockSessionsService.create.mockResolvedValue(created);

      expect(await controller.create(dto)).toEqual(created);
      expect(mockSessionsService.create).toHaveBeenCalledWith(dto);
    });
  });

  describe('findAll', () => {
    it('should delegate to sessionsService.findAll with query', async () => {
      const query: GroupSessionQueryDto = { page: 1, perPage: 20 };
      const result = { items: [], meta: { total: 0 } };
      mockSessionsService.findAll.mockResolvedValue(result);

      expect(await controller.findAll(query)).toEqual(result);
      expect(mockSessionsService.findAll).toHaveBeenCalledWith(query);
    });
  });

  describe('findOne', () => {
    it('should delegate to sessionsService.findOne with id', async () => {
      const session = { id: 'session-1', nameAr: 'جلسة' };
      mockSessionsService.findOne.mockResolvedValue(session);

      expect(await controller.findOne('session-1')).toEqual(session);
      expect(mockSessionsService.findOne).toHaveBeenCalledWith('session-1');
    });
  });

  describe('update', () => {
    it('should delegate to sessionsService.update with id and dto', async () => {
      const dto: UpdateGroupSessionDto = { nameEn: 'Updated' };
      const updated = { id: 'session-1', nameEn: 'Updated' };
      mockSessionsService.update.mockResolvedValue(updated);

      expect(await controller.update('session-1', dto)).toEqual(updated);
      expect(mockSessionsService.update).toHaveBeenCalledWith('session-1', dto);
    });
  });

  describe('remove', () => {
    it('should delegate to sessionsService.remove with id', async () => {
      mockSessionsService.remove.mockResolvedValue({ deleted: true });

      expect(await controller.remove('session-1')).toEqual({ deleted: true });
      expect(mockSessionsService.remove).toHaveBeenCalledWith('session-1');
    });
  });

  describe('cancel', () => {
    it('should delegate to sessionsService.cancel with id', async () => {
      mockSessionsService.cancel.mockResolvedValue({ cancelled: true });

      expect(await controller.cancel('session-1')).toEqual({ cancelled: true });
      expect(mockSessionsService.cancel).toHaveBeenCalledWith('session-1');
    });
  });

  describe('complete', () => {
    it('should delegate to sessionsService.complete with id and attendedPatientIds', async () => {
      const dto: MarkAttendanceDto = { attendedPatientIds: ['patient-1', 'patient-2'] };
      mockSessionsService.complete.mockResolvedValue({ completed: true });

      expect(await controller.complete('session-1', dto)).toEqual({ completed: true });
      expect(mockSessionsService.complete).toHaveBeenCalledWith(
        'session-1',
        ['patient-1', 'patient-2'],
      );
    });

    it('should handle empty attendedPatientIds', async () => {
      const dto: MarkAttendanceDto = { attendedPatientIds: [] };
      mockSessionsService.complete.mockResolvedValue({ completed: true });

      expect(await controller.complete('session-1', dto)).toEqual({ completed: true });
      expect(mockSessionsService.complete).toHaveBeenCalledWith('session-1', []);
    });
  });

  // ─── Enrollments ──────────────────────────────────────────

  describe('enroll', () => {
    it('should delegate to enrollmentsService.enroll with sessionId and patientId', async () => {
      const dto: EnrollPatientDto = { patientId: 'patient-1' };
      const enrollment = { id: 'enr-1', groupSessionId: 'session-1', patientId: 'patient-1' };
      mockEnrollmentsService.enroll.mockResolvedValue(enrollment);

      expect(await controller.enroll('session-1', dto)).toEqual(enrollment);
      expect(mockEnrollmentsService.enroll).toHaveBeenCalledWith('session-1', 'patient-1');
    });
  });

  describe('removeEnrollment', () => {
    it('should delegate to enrollmentsService.removeEnrollment with enrollmentId', async () => {
      mockEnrollmentsService.removeEnrollment.mockResolvedValue({ cancelled: true });

      expect(await controller.removeEnrollment('enr-1')).toEqual({ cancelled: true });
      expect(mockEnrollmentsService.removeEnrollment).toHaveBeenCalledWith('enr-1');
    });
  });
});
