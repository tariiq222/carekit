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

    const result = await ctx.service.createVacation(mockPractitioner.id, vacationDto);

    expect(result).toHaveProperty('id');
    expect(ctx.mockPrisma.practitionerVacation.create).toHaveBeenCalled();
  });

  it.each([
    ['endDate before startDate', { startDate: '2026-05-05', endDate: '2026-05-01' }],
    ['overlapping dates', { startDate: '2026-04-13', endDate: '2026-04-20' }],
  ])('should reject %s', async (_label, dto) => {
    ctx.mockPrisma.practitioner.findFirst.mockResolvedValue(mockPractitioner);
    ctx.mockPrisma.practitionerVacation.findMany.mockResolvedValue(
      _label.includes('overlap') ? [mockVacation] : [],
    );

    await expect(
      ctx.service.createVacation(mockPractitioner.id, dto),
    ).rejects.toThrow(BadRequestException);
  });

  it('should throw NotFoundException if practitioner not found', async () => {
    ctx.mockPrisma.practitioner.findFirst.mockResolvedValue(null);

    await expect(
      ctx.service.createVacation('non-existent-id', vacationDto),
    ).rejects.toThrow(NotFoundException);
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
    ctx.mockPrisma.practitionerVacation.findMany.mockResolvedValue([mockVacation]);

    const result = await ctx.service.listVacations(mockPractitioner.id);

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
    ctx.mockPrisma.practitionerVacation.findUnique.mockResolvedValue(mockVacation);
    ctx.mockPrisma.practitionerVacation.delete.mockResolvedValue(mockVacation);

    await ctx.service.deleteVacation(mockPractitioner.id, mockVacation.id);

    expect(ctx.mockPrisma.practitionerVacation.delete).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: mockVacation.id } }),
    );
  });

  it('should throw NotFoundException if vacation not found', async () => {
    ctx.mockPrisma.practitionerVacation.findUnique.mockResolvedValue(null);

    await expect(
      ctx.service.deleteVacation(mockPractitioner.id, 'non-existent-id'),
    ).rejects.toThrow(NotFoundException);
  });

  it('should prevent deleting vacation belonging to another practitioner', async () => {
    ctx.mockPrisma.practitionerVacation.findUnique.mockResolvedValue({
      ...mockVacation,
      practitionerId: 'other-practitioner-id',
    });

    await expect(
      ctx.service.deleteVacation(mockPractitioner.id, mockVacation.id),
    ).rejects.toThrow(NotFoundException);
  });
});
