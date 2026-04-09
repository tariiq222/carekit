/**
 * Group Sessions DTOs — Validation & Transform Unit Tests
 * Covers: CreateGroupSessionDto, UpdateGroupSessionDto, GroupSessionQueryDto,
 *         EnrollPatientDto, MarkAttendanceDto
 */
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateGroupSessionDto } from '../../../src/modules/group-sessions/dto/create-group-session.dto.js';
import { UpdateGroupSessionDto } from '../../../src/modules/group-sessions/dto/update-group-session.dto.js';
import { GroupSessionQueryDto } from '../../../src/modules/group-sessions/dto/group-session-query.dto.js';
import { EnrollPatientDto } from '../../../src/modules/group-sessions/dto/enroll-patient.dto.js';
import { MarkAttendanceDto } from '../../../src/modules/group-sessions/dto/mark-attendance.dto.js';

const validCreateBase = {
  nameAr: 'جلسة علاج جماعي',
  nameEn: 'Group Therapy',
  practitionerId: '550e8400-e29b-41d4-a716-446655440000',
  minParticipants: 3,
  maxParticipants: 10,
  pricePerPersonHalalat: 100,
  durationMinutes: 60,
  schedulingMode: 'fixed_date' as const,
  startTime: '2026-06-01T10:00:00.000Z',
};

async function getErrors(DtoClass: new () => object, data: Record<string, unknown>) {
  const dto = plainToInstance(DtoClass, data);
  return validate(dto);
}

// ─────────────────────────────────────────────────────────────
// CreateGroupSessionDto
// ─────────────────────────────────────────────────────────────

describe('CreateGroupSessionDto', () => {
  it('should pass with all valid fields', async () => {
    const errors = await getErrors(CreateGroupSessionDto, validCreateBase);
    expect(errors).toHaveLength(0);
  });

  it('should trim nameAr via @Transform', () => {
    const dto = plainToInstance(CreateGroupSessionDto, {
      ...validCreateBase,
      nameAr: '  جلسة  ',
    });
    expect(dto.nameAr).toBe('جلسة');
  });

  it('should trim nameEn via @Transform', () => {
    const dto = plainToInstance(CreateGroupSessionDto, {
      ...validCreateBase,
      nameEn: '  Therapy  ',
    });
    expect(dto.nameEn).toBe('Therapy');
  });

  it('should reject empty nameAr', async () => {
    const errors = await getErrors(CreateGroupSessionDto, {
      ...validCreateBase,
      nameAr: '',
    });
    expect(errors.some((e) => e.property === 'nameAr')).toBe(true);
  });

  it('should reject empty nameEn', async () => {
    const errors = await getErrors(CreateGroupSessionDto, {
      ...validCreateBase,
      nameEn: '',
    });
    expect(errors.some((e) => e.property === 'nameEn')).toBe(true);
  });

  it('should reject nameAr exceeding 255 chars', async () => {
    const errors = await getErrors(CreateGroupSessionDto, {
      ...validCreateBase,
      nameAr: 'ج'.repeat(256),
    });
    expect(errors.some((e) => e.property === 'nameAr')).toBe(true);
  });

  it('should reject invalid practitionerId (not UUID)', async () => {
    const errors = await getErrors(CreateGroupSessionDto, {
      ...validCreateBase,
      practitionerId: 'not-a-uuid',
    });
    expect(errors.some((e) => e.property === 'practitionerId')).toBe(true);
  });

  it('should reject minParticipants < 1', async () => {
    const errors = await getErrors(CreateGroupSessionDto, {
      ...validCreateBase,
      minParticipants: 0,
    });
    expect(errors.some((e) => e.property === 'minParticipants')).toBe(true);
  });

  it('should reject negative pricePerPersonHalalat', async () => {
    const errors = await getErrors(CreateGroupSessionDto, {
      ...validCreateBase,
      pricePerPersonHalalat: -1,
    });
    expect(errors.some((e) => e.property === 'pricePerPersonHalalat')).toBe(true);
  });

  it('should accept pricePerPersonHalalat = 0 (free session)', async () => {
    const errors = await getErrors(CreateGroupSessionDto, {
      ...validCreateBase,
      pricePerPersonHalalat: 0,
    });
    expect(errors.some((e) => e.property === 'pricePerPersonHalalat')).toBe(false);
  });

  it('should reject invalid schedulingMode', async () => {
    const errors = await getErrors(CreateGroupSessionDto, {
      ...validCreateBase,
      schedulingMode: 'invalid_mode',
    });
    expect(errors.some((e) => e.property === 'schedulingMode')).toBe(true);
  });

  it('should require startTime when schedulingMode is fixed_date', async () => {
    const errors = await getErrors(CreateGroupSessionDto, {
      ...validCreateBase,
      schedulingMode: 'fixed_date',
      startTime: undefined,
    });
    expect(errors.some((e) => e.property === 'startTime')).toBe(true);
  });

  it('should allow missing startTime when schedulingMode is on_capacity', async () => {
    const errors = await getErrors(CreateGroupSessionDto, {
      ...validCreateBase,
      schedulingMode: 'on_capacity',
      startTime: undefined,
    });
    expect(errors.some((e) => e.property === 'startTime')).toBe(false);
  });

  it('should accept optional isPublished', async () => {
    const errors = await getErrors(CreateGroupSessionDto, {
      ...validCreateBase,
      isPublished: true,
    });
    expect(errors).toHaveLength(0);
  });

  it('should accept optional expiresAt as ISO date string', async () => {
    const errors = await getErrors(CreateGroupSessionDto, {
      ...validCreateBase,
      expiresAt: '2026-07-01T00:00:00.000Z',
    });
    expect(errors).toHaveLength(0);
  });

  it('should reject invalid expiresAt', async () => {
    const errors = await getErrors(CreateGroupSessionDto, {
      ...validCreateBase,
      expiresAt: 'not-a-date',
    });
    expect(errors.some((e) => e.property === 'expiresAt')).toBe(true);
  });

  it('should accept optional departmentId as UUID', async () => {
    const errors = await getErrors(CreateGroupSessionDto, {
      ...validCreateBase,
      departmentId: '550e8400-e29b-41d4-a716-446655440001',
    });
    expect(errors).toHaveLength(0);
  });

  it('should reject invalid departmentId', async () => {
    const errors = await getErrors(CreateGroupSessionDto, {
      ...validCreateBase,
      departmentId: 'bad-uuid',
    });
    expect(errors.some((e) => e.property === 'departmentId')).toBe(true);
  });

  it('should accept optional descriptionAr', async () => {
    const errors = await getErrors(CreateGroupSessionDto, {
      ...validCreateBase,
      descriptionAr: 'وصف الجلسة',
    });
    expect(errors).toHaveLength(0);
  });

  it('should reject descriptionAr exceeding 1000 chars', async () => {
    const errors = await getErrors(CreateGroupSessionDto, {
      ...validCreateBase,
      descriptionAr: 'و'.repeat(1001),
    });
    expect(errors.some((e) => e.property === 'descriptionAr')).toBe(true);
  });

  it('should reject paymentDeadlineHours < 1', async () => {
    const errors = await getErrors(CreateGroupSessionDto, {
      ...validCreateBase,
      paymentDeadlineHours: 0,
    });
    expect(errors.some((e) => e.property === 'paymentDeadlineHours')).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────
// UpdateGroupSessionDto
// ─────────────────────────────────────────────────────────────

describe('UpdateGroupSessionDto', () => {
  it('should pass with empty object (all fields optional)', async () => {
    const errors = await getErrors(UpdateGroupSessionDto, {});
    expect(errors).toHaveLength(0);
  });

  it('should trim nameAr via @Transform', () => {
    const dto = plainToInstance(UpdateGroupSessionDto, { nameAr: '  محدث  ' });
    expect(dto.nameAr).toBe('محدث');
  });

  it('should trim nameEn via @Transform', () => {
    const dto = plainToInstance(UpdateGroupSessionDto, { nameEn: '  Updated  ' });
    expect(dto.nameEn).toBe('Updated');
  });

  it('should reject nameAr exceeding 255 chars', async () => {
    const errors = await getErrors(UpdateGroupSessionDto, {
      nameAr: 'ج'.repeat(256),
    });
    expect(errors.some((e) => e.property === 'nameAr')).toBe(true);
  });

  it('should reject invalid practitionerId', async () => {
    const errors = await getErrors(UpdateGroupSessionDto, {
      practitionerId: 'not-uuid',
    });
    expect(errors.some((e) => e.property === 'practitionerId')).toBe(true);
  });

  it('should reject invalid startTime', async () => {
    const errors = await getErrors(UpdateGroupSessionDto, {
      startTime: 'not-a-date',
    });
    expect(errors.some((e) => e.property === 'startTime')).toBe(true);
  });

  it('should accept valid partial update', async () => {
    const errors = await getErrors(UpdateGroupSessionDto, {
      nameEn: 'Updated',
      maxParticipants: 15,
    });
    expect(errors).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────
// GroupSessionQueryDto
// ─────────────────────────────────────────────────────────────

describe('GroupSessionQueryDto', () => {
  it('should pass with empty query', async () => {
    const errors = await getErrors(GroupSessionQueryDto, {});
    expect(errors).toHaveLength(0);
  });

  it('should trim search via @Transform', () => {
    const dto = plainToInstance(GroupSessionQueryDto, { search: '  therapy  ' });
    expect(dto.search).toBe('therapy');
  });

  it('should reject invalid status enum', async () => {
    const errors = await getErrors(GroupSessionQueryDto, { status: 'invalid' });
    expect(errors.some((e) => e.property === 'status')).toBe(true);
  });

  it('should accept valid status', async () => {
    const errors = await getErrors(GroupSessionQueryDto, { status: 'open' });
    expect(errors.some((e) => e.property === 'status')).toBe(false);
  });

  it('should reject invalid visibility enum', async () => {
    const errors = await getErrors(GroupSessionQueryDto, { visibility: 'all' });
    expect(errors.some((e) => e.property === 'visibility')).toBe(true);
  });

  it('should accept valid visibility', async () => {
    const errors = await getErrors(GroupSessionQueryDto, { visibility: 'published' });
    expect(errors.some((e) => e.property === 'visibility')).toBe(false);
  });

  it('should reject invalid practitionerId', async () => {
    const errors = await getErrors(GroupSessionQueryDto, { practitionerId: 'bad' });
    expect(errors.some((e) => e.property === 'practitionerId')).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────
// EnrollPatientDto
// ─────────────────────────────────────────────────────────────

describe('EnrollPatientDto', () => {
  it('should pass with valid UUID', async () => {
    const errors = await getErrors(EnrollPatientDto, {
      patientId: '550e8400-e29b-41d4-a716-446655440000',
    });
    expect(errors).toHaveLength(0);
  });

  it('should reject missing patientId', async () => {
    const errors = await getErrors(EnrollPatientDto, {});
    expect(errors.some((e) => e.property === 'patientId')).toBe(true);
  });

  it('should reject invalid patientId', async () => {
    const errors = await getErrors(EnrollPatientDto, { patientId: 'not-uuid' });
    expect(errors.some((e) => e.property === 'patientId')).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────
// MarkAttendanceDto
// ─────────────────────────────────────────────────────────────

describe('MarkAttendanceDto', () => {
  it('should pass with valid UUID array', async () => {
    const errors = await getErrors(MarkAttendanceDto, {
      attendedPatientIds: [
        '550e8400-e29b-41d4-a716-446655440000',
        '550e8400-e29b-41d4-a716-446655440001',
      ],
    });
    expect(errors).toHaveLength(0);
  });

  it('should pass with empty array', async () => {
    const errors = await getErrors(MarkAttendanceDto, { attendedPatientIds: [] });
    expect(errors).toHaveLength(0);
  });

  it('should reject missing attendedPatientIds', async () => {
    const errors = await getErrors(MarkAttendanceDto, {});
    expect(errors.some((e) => e.property === 'attendedPatientIds')).toBe(true);
  });

  it('should reject non-UUID values in array', async () => {
    const errors = await getErrors(MarkAttendanceDto, {
      attendedPatientIds: ['not-uuid'],
    });
    expect(errors.some((e) => e.property === 'attendedPatientIds')).toBe(true);
  });
});
