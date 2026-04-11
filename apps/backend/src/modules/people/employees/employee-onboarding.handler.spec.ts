import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { EmployeeOnboardingHandler } from './employee-onboarding.handler';

// Use string literals — OnboardingStatus enum is added in the next migration
const OnboardingStatus = {
  PENDING: 'PENDING',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
} as const;

const mockEmployee = {
  id: 'emp-1',
  tenantId: 'tenant-1',
  onboardingStatus: OnboardingStatus.PENDING,
  name: 'Ahmed',
};

const mockPrisma = {
  employee: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  employeeSpecialty: {
    deleteMany: jest.fn(),
    createMany: jest.fn(),
  },
  employeeBranch: {
    deleteMany: jest.fn(),
    createMany: jest.fn(),
  },
  employeeService: {
    deleteMany: jest.fn(),
    createMany: jest.fn(),
  },
};

describe('EmployeeOnboardingHandler', () => {
  let handler: EmployeeOnboardingHandler;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let prisma: any;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmployeeOnboardingHandler,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    handler = module.get(EmployeeOnboardingHandler);
    prisma = module.get(PrismaService);
  });

  describe('employee not found', () => {
    it('throws NotFoundException when employee does not exist', async () => {
      prisma.employee.findUnique.mockResolvedValue(null);

      await expect(
        handler.execute({
          employeeId: 'emp-1',
          tenantId: 'tenant-1',
          step: 'profile',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when tenantId does not match', async () => {
      prisma.employee.findUnique.mockResolvedValue(mockEmployee);

      await expect(
        handler.execute({
          employeeId: 'emp-1',
          tenantId: 'wrong-tenant',
          step: 'profile',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('profile step', () => {
    it('updates employee fields and sets onboardingStatus to IN_PROGRESS when PENDING', async () => {
      const updated = { ...mockEmployee, name: 'Ali', onboardingStatus: OnboardingStatus.IN_PROGRESS };
      prisma.employee.findUnique
        .mockResolvedValueOnce(mockEmployee)
        .mockResolvedValueOnce(updated);
      prisma.employee.update.mockResolvedValue(updated);

      const result = await handler.execute({
        employeeId: 'emp-1',
        tenantId: 'tenant-1',
        step: 'profile',
        profile: { name: 'Ali' },
      });

      expect(prisma.employee.update).toHaveBeenCalledWith({
        where: { id: 'emp-1' },
        data: {
          name: 'Ali',
          onboardingStatus: OnboardingStatus.IN_PROGRESS,
        },
      });
      expect(result).toEqual(updated);
    });

    it('does not override onboardingStatus when already IN_PROGRESS', async () => {
      const inProgressEmployee = { ...mockEmployee, onboardingStatus: OnboardingStatus.IN_PROGRESS };
      prisma.employee.findUnique
        .mockResolvedValueOnce(inProgressEmployee)
        .mockResolvedValueOnce(inProgressEmployee);
      prisma.employee.update.mockResolvedValue(inProgressEmployee);

      await handler.execute({
        employeeId: 'emp-1',
        tenantId: 'tenant-1',
        step: 'profile',
        profile: { name: 'Ali' },
      });

      expect(prisma.employee.update).toHaveBeenCalledWith({
        where: { id: 'emp-1' },
        data: { name: 'Ali' },
      });
    });
  });

  describe('specialties step', () => {
    it('deletes existing specialties and creates new ones', async () => {
      prisma.employee.findUnique
        .mockResolvedValueOnce(mockEmployee)
        .mockResolvedValueOnce(mockEmployee);
      prisma.employeeSpecialty.deleteMany.mockResolvedValue({ count: 2 });
      prisma.employeeSpecialty.createMany.mockResolvedValue({ count: 2 });
      prisma.employee.update.mockResolvedValue(mockEmployee);

      await handler.execute({
        employeeId: 'emp-1',
        tenantId: 'tenant-1',
        step: 'specialties',
        specialtyIds: ['spec-1', 'spec-2'],
      });

      expect(prisma.employeeSpecialty.deleteMany).toHaveBeenCalledWith({
        where: { employeeId: 'emp-1' },
      });
      expect(prisma.employeeSpecialty.createMany).toHaveBeenCalledWith({
        data: [
          { tenantId: 'tenant-1', employeeId: 'emp-1', specialtyId: 'spec-1' },
          { tenantId: 'tenant-1', employeeId: 'emp-1', specialtyId: 'spec-2' },
        ],
      });
      expect(prisma.employee.update).toHaveBeenCalledWith({
        where: { id: 'emp-1' },
        data: { onboardingStatus: OnboardingStatus.IN_PROGRESS },
      });
    });
  });

  describe('complete step', () => {
    it('sets onboardingStatus to COMPLETED', async () => {
      const completed = { ...mockEmployee, onboardingStatus: OnboardingStatus.COMPLETED };
      prisma.employee.findUnique
        .mockResolvedValueOnce(mockEmployee)
        .mockResolvedValueOnce(completed);
      prisma.employee.update.mockResolvedValue(completed);

      const result = await handler.execute({
        employeeId: 'emp-1',
        tenantId: 'tenant-1',
        step: 'complete',
      });

      expect(prisma.employee.update).toHaveBeenCalledWith({
        where: { id: 'emp-1' },
        data: { onboardingStatus: OnboardingStatus.COMPLETED },
      });
      expect(result).toEqual(completed);
    });
  });
});
