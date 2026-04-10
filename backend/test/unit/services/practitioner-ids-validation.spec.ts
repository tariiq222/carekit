/**
 * Regression tests for HIGH fix #9:
 * practitionerIds in CreateServiceDto were passed directly to Prisma without
 * existence validation — resulting in raw P2003 FK constraint errors instead of
 * a clean 404 NotFoundException.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ServicesService } from '../../../src/modules/services/services.service.js';
import { PrismaService } from '../../../src/database/prisma.service.js';
import { CacheService } from '../../../src/common/services/cache.service.js';
import { IntakeFormsService } from '../../../src/modules/intake-forms/intake-forms.service.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma: any = {
  service: { create: jest.fn(), findMany: jest.fn(), findFirst: jest.fn(), count: jest.fn() },
  practitioner: { findMany: jest.fn() },
  serviceCategory: { findUnique: jest.fn() },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockCache: any = { get: jest.fn().mockResolvedValue(null), set: jest.fn(), del: jest.fn() };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockIntakeForms: any = {};

const BASE_DTO = {
  name: 'Test Service',
  nameAr: 'خدمة تجريبية',
  categoryId: 'cat-uuid',
  price: 100,
  duration: 30,
  isActive: true,
};

describe('ServicesService — practitionerIds validation (fix #9)', () => {
  let service: ServicesService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma.serviceCategory = { findUnique: jest.fn().mockResolvedValue({ id: 'cat-uuid' }) };
    mockPrisma.service.create.mockResolvedValue({ id: 'svc-new', ...BASE_DTO });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ServicesService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: CacheService, useValue: mockCache },
        { provide: IntakeFormsService, useValue: mockIntakeForms },
      ],
    }).compile();

    service = module.get(ServicesService);
  });

  it('REGRESSION: throws NotFoundException (404) when practitionerId does not exist', async () => {
    // Before fix: Prisma threw raw P2003 FK constraint error
    // After fix: clean 404 with practitioner IDs listed
    mockPrisma.practitioner.findMany.mockResolvedValue([]); // no practitioners found

    await expect(
      service.create({ ...BASE_DTO, practitionerIds: ['non-existent-uuid'] }),
    ).rejects.toMatchObject({
      response: { statusCode: 404, error: 'PRACTITIONER_NOT_FOUND' },
    });
  });

  it('throws NotFoundException listing all missing IDs', async () => {
    mockPrisma.practitioner.findMany.mockResolvedValue([
      { id: 'prac-1' }, // only prac-1 found
    ]);

    await expect(
      service.create({ ...BASE_DTO, practitionerIds: ['prac-1', 'prac-missing-2', 'prac-missing-3'] }),
    ).rejects.toMatchObject({
      response: {
        message: expect.stringContaining('prac-missing-2'),
      },
    });
  });

  it('proceeds when all practitionerIds exist', async () => {
    mockPrisma.practitioner.findMany.mockResolvedValue([{ id: 'prac-1' }, { id: 'prac-2' }]);

    await expect(
      service.create({ ...BASE_DTO, practitionerIds: ['prac-1', 'prac-2'] }),
    ).resolves.not.toThrow();

    expect(mockPrisma.service.create).toHaveBeenCalled();
  });

  it('skips validation when practitionerIds is empty or undefined', async () => {
    await service.create({ ...BASE_DTO });

    expect(mockPrisma.practitioner.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.service.create).toHaveBeenCalled();
  });
});
