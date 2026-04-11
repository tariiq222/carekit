/**
 * ServicePractitionersService — Unit Tests
 * Covers: getPractitionersForService (not found, without branchId, with branchId)
 */
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ServicePractitionersService } from '../../../src/modules/services/service-practitioners.service.js';
import { ServicesService } from '../../../src/modules/services/services.service.js';
import { PrismaService } from '../../../src/database/prisma.service.js';
import { createMockPrisma } from './services.fixtures.js';

const SERVICE_ID = 'service-uuid-1';
const BRANCH_ID = 'branch-uuid-1';

const mockPractitionerService = {
  id: 'practitioner-service-uuid-1',
  serviceId: SERVICE_ID,
  practitionerId: 'practitioner-uuid-1',
  createdAt: new Date('2026-01-15'),
  practitioner: {
    id: 'practitioner-uuid-1',
    avatarUrl: null,
    nameAr: 'الدكتور أحمد',
    title: 'MD',
    isActive: true,
    user: { firstName: 'Ahmad', lastName: 'Al-Farsi' },
  },
  serviceTypes: [],
};

function createMockServicesService() {
  return {
    ensureExists: jest.fn(),
  };
}

async function createModule(
  mockPrisma: ReturnType<typeof createMockPrisma>,
  mockServicesService: ReturnType<typeof createMockServicesService>,
) {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      ServicePractitionersService,
      { provide: PrismaService, useValue: mockPrisma },
      { provide: ServicesService, useValue: mockServicesService },
    ],
  }).compile();
  return module.get<ServicePractitionersService>(ServicePractitionersService);
}

describe('ServicePractitionersService — getPractitionersForService', () => {
  let service: ServicePractitionersService;
  let mockPrisma: ReturnType<typeof createMockPrisma>;
  let mockServicesService: ReturnType<typeof createMockServicesService>;

  beforeEach(async () => {
    mockPrisma = createMockPrisma();
    mockServicesService = createMockServicesService();
    service = await createModule(mockPrisma, mockServicesService);
    jest.clearAllMocks();
  });

  it('should throw NotFoundException when service does not exist', async () => {
    mockServicesService.ensureExists.mockRejectedValue(
      new NotFoundException({
        statusCode: 404,
        message: 'Service not found',
        error: 'NOT_FOUND',
      }),
    );

    await expect(
      service.getPractitionersForService('non-existent-id'),
    ).rejects.toThrow(NotFoundException);
  });

  it('should return all practitioners without branch filter when branchId is not provided', async () => {
    mockServicesService.ensureExists.mockResolvedValue(undefined);
    mockPrisma.practitionerService = {
      findMany: jest.fn().mockResolvedValue([mockPractitionerService]),
    };

    const result = await service.getPractitionersForService(SERVICE_ID);

    expect(result).toEqual([mockPractitionerService]);
    const whereArg =
      mockPrisma.practitionerService.findMany.mock.calls[0][0].where;
    expect(whereArg.serviceId).toBe(SERVICE_ID);
    expect(whereArg.practitioner).toMatchObject({
      isActive: true,
      deletedAt: null,
    });
  });

  it('should filter practitioners by branch when branchId is provided', async () => {
    mockServicesService.ensureExists.mockResolvedValue(undefined);
    mockPrisma.practitionerService = {
      findMany: jest.fn().mockResolvedValue([mockPractitionerService]),
    };

    await service.getPractitionersForService(SERVICE_ID, BRANCH_ID);

    const whereArg =
      mockPrisma.practitionerService.findMany.mock.calls[0][0].where;
    expect(whereArg.serviceId).toBe(SERVICE_ID);
    expect(whereArg.practitioner).toMatchObject({
      isActive: true,
      deletedAt: null,
      branches: { some: { branchId: BRANCH_ID } },
    });
  });

  it('should call ensureExists before querying practitioners', async () => {
    mockServicesService.ensureExists.mockResolvedValue(undefined);
    mockPrisma.practitionerService = {
      findMany: jest.fn().mockResolvedValue([]),
    };

    await service.getPractitionersForService(SERVICE_ID);

    expect(mockServicesService.ensureExists).toHaveBeenCalledWith(SERVICE_ID);
    expect(mockServicesService.ensureExists).toHaveBeenCalledTimes(1);
  });

  it('[REGRESSION] should exclude practitioners with isAcceptingBookings=false', async () => {
    mockServicesService.ensureExists.mockResolvedValue(undefined);
    mockPrisma.practitionerService = {
      findMany: jest.fn().mockResolvedValue([mockPractitionerService]),
    };

    await service.getPractitionersForService(SERVICE_ID);

    expect(mockPrisma.practitionerService.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          practitioner: expect.objectContaining({
            isAcceptingBookings: true,
          }),
        }),
      }),
    );
  });

  it('should only return active, non-deleted practitioners', async () => {
    mockServicesService.ensureExists.mockResolvedValue(undefined);
    mockPrisma.practitionerService = {
      findMany: jest.fn().mockResolvedValue([
        {
          practitioner: {
            id: 'p-1',
            isActive: true,
            deletedAt: null,
            nameAr: 'طبيب',
            title: 'Dr',
            user: { firstName: 'Ahmad', lastName: 'Ali', avatarUrl: null },
          },
          serviceTypes: [],
        },
        {
          practitioner: {
            id: 'p-2',
            isActive: false,
            deletedAt: null,
            nameAr: 'طبيب',
            title: 'Dr',
            user: { firstName: 'Khalid', lastName: 'Omar', avatarUrl: null },
          },
          serviceTypes: [],
        },
      ] as never),
    };

    await service.getPractitionersForService(SERVICE_ID);

    expect(mockPrisma.practitionerService.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          practitioner: expect.objectContaining({
            isActive: true,
            deletedAt: null,
          }),
        }),
      }),
    );
  });
});
