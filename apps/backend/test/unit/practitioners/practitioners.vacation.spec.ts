/**
 * PractitionersService — Vacation Tests
 * Covers: createVacation, listVacations, deleteVacation
 */
import { NotFoundException, BadRequestException } from '@nestjs/common';
import {
  createPractitionersTestModule,
  PractitionersTestContext,
} from './practitioners.test-module.js';
import { mockPractitioner, mockVacation } from './practitioners.fixtures.js';

describe('PractitionersService — createVacation', () => {
  let ctx: PractitionersTestContext;

  const vacationDto = {
    startDate: '2026-05-01',
    endDate: '2026-05-05',
    reason: 'إجازة شخصية',
  };

  beforeEach(async () => {
    ctx = await createPractitionersTestModule();
    jest.clearAllMocks();
  });

  it('should create a vacation record', async () => {
    ctx.mockPrisma.practitioner.findFirst.mockResolvedValue(mockPractitioner);
    ctx.mockPrisma.practitionerVacation.findMany.mockResolvedValue([]);
    ctx.mockPrisma.practitionerVacation.create.mockResolvedValue({
      ...mockVacation,
      ...vacationDto,
      id: 'new-vacation-uuid',
    });

    const result = await ctx.vacationService.createVacation(
      mockPractitioner.id,
      vacationDto,
    );

    expect(result).toHaveProperty('id');
    expect(ctx.mockPrisma.practitionerVacation.create).toHaveBeenCalled();
  });

  it.each([
    [
      'endDate before startDate',
      { startDate: '2026-05-05', endDate: '2026-05-01' },
    ],
    ['overlapping dates', { startDate: '2026-04-13', endDate: '2026-04-20' }],
  ])('should reject %s', async (_label, dto) => {
    ctx.mockPrisma.practitioner.findFirst.mockResolvedValue(mockPractitioner);
    ctx.mockPrisma.practitionerVacation.findMany.mockResolvedValue(
      _label.includes('overlap') ? [mockVacation] : [],
    );

    await expect(
      ctx.vacationService.createVacation(mockPractitioner.id, dto),
    ).rejects.toThrow(BadRequestException);
  });

  it('should throw NotFoundException if practitioner not found', async () => {
    ctx.mockPrisma.practitioner.findFirst.mockResolvedValue(null);

    await expect(
      ctx.vacationService.createVacation('non-existent-id', vacationDto),
    ).rejects.toThrow(NotFoundException);
  });

  // Existing vacation: Apr 10-15 (mockVacation)

  it('rejects fully-contained range (new inside existing)', async () => {
    ctx.mockPrisma.practitioner.findFirst.mockResolvedValue(mockPractitioner);
    ctx.mockPrisma.practitionerVacation.findMany.mockResolvedValue([
      mockVacation,
    ]);

    await expect(
      ctx.vacationService.createVacation(mockPractitioner.id, {
        startDate: '2026-04-11',
        endDate: '2026-04-14',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects range that contains existing (existing inside new)', async () => {
    ctx.mockPrisma.practitioner.findFirst.mockResolvedValue(mockPractitioner);
    ctx.mockPrisma.practitionerVacation.findMany.mockResolvedValue([
      mockVacation,
    ]);

    await expect(
      ctx.vacationService.createVacation(mockPractitioner.id, {
        startDate: '2026-04-08',
        endDate: '2026-04-20',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects partial overlap at the end (new starts inside existing)', async () => {
    ctx.mockPrisma.practitioner.findFirst.mockResolvedValue(mockPractitioner);
    ctx.mockPrisma.practitionerVacation.findMany.mockResolvedValue([
      mockVacation,
    ]);

    // Existing Apr 10-15, New Apr 13-20 → overlaps
    await expect(
      ctx.vacationService.createVacation(mockPractitioner.id, {
        startDate: '2026-04-13',
        endDate: '2026-04-20',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects partial overlap at the start (new ends inside existing)', async () => {
    ctx.mockPrisma.practitioner.findFirst.mockResolvedValue(mockPractitioner);
    ctx.mockPrisma.practitionerVacation.findMany.mockResolvedValue([
      mockVacation,
    ]);

    // Existing Apr 10-15, New Apr 05-12 → overlaps
    await expect(
      ctx.vacationService.createVacation(mockPractitioner.id, {
        startDate: '2026-04-05',
        endDate: '2026-04-12',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('allows non-overlapping range before existing', async () => {
    ctx.mockPrisma.practitioner.findFirst.mockResolvedValue(mockPractitioner);
    ctx.mockPrisma.practitionerVacation.findMany.mockResolvedValue([
      mockVacation,
    ]);
    ctx.mockPrisma.practitionerVacation.create.mockResolvedValue({
      ...mockVacation,
      id: 'new-vac',
      startDate: new Date('2026-04-01'),
      endDate: new Date('2026-04-09'),
    });

    const result = await ctx.vacationService.createVacation(
      mockPractitioner.id,
      {
        startDate: '2026-04-01',
        endDate: '2026-04-09',
      },
    );

    expect(result).toHaveProperty('id', 'new-vac');
  });

  it('allows non-overlapping range after existing', async () => {
    ctx.mockPrisma.practitioner.findFirst.mockResolvedValue(mockPractitioner);
    ctx.mockPrisma.practitionerVacation.findMany.mockResolvedValue([
      mockVacation,
    ]);
    ctx.mockPrisma.practitionerVacation.create.mockResolvedValue({
      ...mockVacation,
      id: 'new-vac',
      startDate: new Date('2026-04-16'),
      endDate: new Date('2026-04-20'),
    });

    const result = await ctx.vacationService.createVacation(
      mockPractitioner.id,
      {
        startDate: '2026-04-16',
        endDate: '2026-04-20',
      },
    );

    expect(result).toHaveProperty('id', 'new-vac');
  });

  it('rejects invalid startDate string', async () => {
    ctx.mockPrisma.practitioner.findFirst.mockResolvedValue(mockPractitioner);
    ctx.mockPrisma.practitionerVacation.findMany.mockResolvedValue([]);

    await expect(
      ctx.vacationService.createVacation(mockPractitioner.id, {
        startDate: 'not-a-date',
        endDate: '2026-05-10',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects invalid endDate string', async () => {
    ctx.mockPrisma.practitioner.findFirst.mockResolvedValue(mockPractitioner);
    ctx.mockPrisma.practitionerVacation.findMany.mockResolvedValue([]);

    await expect(
      ctx.vacationService.createVacation(mockPractitioner.id, {
        startDate: '2026-05-01',
        endDate: 'not-a-date',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects startDate equal to endDate', async () => {
    ctx.mockPrisma.practitioner.findFirst.mockResolvedValue(mockPractitioner);
    ctx.mockPrisma.practitionerVacation.findMany.mockResolvedValue([]);

    await expect(
      ctx.vacationService.createVacation(mockPractitioner.id, {
        startDate: '2026-05-01',
        endDate: '2026-05-01',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  /**
   * TOCTOU regression: overlap check loads vacations into memory then checks.
   * Two concurrent requests with overlapping dates both load an empty list,
   * both pass the guard, and both insert — creating overlapping vacations.
   * No DB-level unique constraint on vacation date ranges exists.
   */
  it('[TOCTOU] concurrent requests both pass in-memory overlap check', async () => {
    ctx.mockPrisma.practitioner.findFirst.mockResolvedValue(mockPractitioner);
    // Both requests load an empty list at the same moment (before either inserts)
    ctx.mockPrisma.practitionerVacation.findMany.mockResolvedValue([]);
    ctx.mockPrisma.practitionerVacation.create.mockResolvedValue({
      ...mockVacation,
      id: 'concurrent-vac',
    });

    // Both succeed — this documents the race condition gap
    const [r1, r2] = await Promise.all([
      ctx.vacationService.createVacation(mockPractitioner.id, {
        startDate: '2026-07-01',
        endDate: '2026-07-15',
      }),
      ctx.vacationService.createVacation(mockPractitioner.id, {
        startDate: '2026-07-01',
        endDate: '2026-07-15',
      }),
    ]);

    expect(r1).toBeDefined();
    expect(r2).toBeDefined();
  });
});

describe('PractitionersService — listVacations', () => {
  let ctx: PractitionersTestContext;

  beforeEach(async () => {
    ctx = await createPractitionersTestModule();
    jest.clearAllMocks();
  });

  it('should return all vacations for a practitioner', async () => {
    ctx.mockPrisma.practitioner.findFirst.mockResolvedValue(mockPractitioner);
    ctx.mockPrisma.practitionerVacation.findMany.mockResolvedValue([
      mockVacation,
    ]);

    const result = await ctx.vacationService.listVacations(mockPractitioner.id);

    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(1);
    expect(result[0]).toHaveProperty('startDate');
    expect(result[0]).toHaveProperty('endDate');
  });
});

describe('PractitionersService — deleteVacation', () => {
  let ctx: PractitionersTestContext;

  beforeEach(async () => {
    ctx = await createPractitionersTestModule();
    jest.clearAllMocks();
  });

  it('should delete a vacation record', async () => {
    ctx.mockPrisma.practitioner.findFirst.mockResolvedValue(mockPractitioner);
    ctx.mockPrisma.practitionerVacation.findUnique.mockResolvedValue(
      mockVacation,
    );
    ctx.mockPrisma.practitionerVacation.delete.mockResolvedValue(mockVacation);

    await ctx.vacationService.deleteVacation(
      mockPractitioner.id,
      mockVacation.id,
    );

    expect(ctx.mockPrisma.practitionerVacation.delete).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: mockVacation.id } }),
    );
  });

  it('should throw NotFoundException if vacation not found', async () => {
    ctx.mockPrisma.practitionerVacation.findUnique.mockResolvedValue(null);

    await expect(
      ctx.vacationService.deleteVacation(
        mockPractitioner.id,
        'non-existent-id',
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('should prevent deleting vacation belonging to another practitioner', async () => {
    ctx.mockPrisma.practitionerVacation.findUnique.mockResolvedValue({
      ...mockVacation,
      practitionerId: 'other-practitioner-id',
    });

    await expect(
      ctx.vacationService.deleteVacation(mockPractitioner.id, mockVacation.id),
    ).rejects.toThrow(NotFoundException);
  });
});
