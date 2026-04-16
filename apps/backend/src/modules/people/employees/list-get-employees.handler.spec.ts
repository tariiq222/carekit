import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { EmploymentType, OnboardingStatus } from '@prisma/client';
import { ListEmployeesHandler } from './list-employees.handler';
import { GetEmployeeHandler } from './get-employee.handler';
import { PrismaService } from '../../../infrastructure/database';

const mockEmployee = {
  id: 'e1',
  name: 'د. سارة الأحمد',
  email: 'sara@clinic.com',
  phone: '0551234567',
  gender: null,
  avatarUrl: null,
  bio: null,
  employmentType: EmploymentType.FULL_TIME,
  onboardingStatus: OnboardingStatus.COMPLETED,
  isActive: true,
  userId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  specialties: [{ id: 'es1', specialtyId: 'sp1', employeeId: 'e1' }],
  branches: [],
  services: [],
  availability: [
    { id: 'av1', dayOfWeek: 0, startTime: '09:00', endTime: '17:00', isActive: true, employeeId: 'e1', createdAt: new Date(), updatedAt: new Date() },
  ],
  exceptions: [],
};

describe('List/Get Employees handlers', () => {
  let listHandler: ListEmployeesHandler;
  let getHandler: GetEmployeeHandler;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let prisma: any;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ListEmployeesHandler,
        GetEmployeeHandler,
        {
          provide: PrismaService,
          useValue: {
            employee: { findMany: jest.fn(), findUnique: jest.fn(), findFirst: jest.fn(), count: jest.fn() },
          },
        },
      ],
    }).compile();

    listHandler = module.get(ListEmployeesHandler);
    getHandler = module.get(GetEmployeeHandler);
    prisma = module.get(PrismaService);
  });

  describe('ListEmployeesHandler', () => {
    it('returns paginated employees with availability', async () => {
      prisma.employee.findMany.mockResolvedValue([mockEmployee]);
      prisma.employee.count.mockResolvedValue(1);

      const result = await listHandler.execute({ page: 1, limit: 10 });

      expect(result.items).toHaveLength(1);
      expect(result.items[0]?.availability).toHaveLength(1);
      expect(result.meta).toMatchObject({ total: 1, page: 1, perPage: 10, totalPages: 1 });
    });

    it('filters by specialtyId', async () => {
      prisma.employee.findMany.mockResolvedValue([]);
      prisma.employee.count.mockResolvedValue(0);

      await listHandler.execute({ page: 1, limit: 10, specialtyId: 'sp1' });

      expect(prisma.employee.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ specialties: { some: { specialtyId: 'sp1' } } }),
        }),
      );
    });

    it('applies search across name, email, phone', async () => {
      prisma.employee.findMany.mockResolvedValue([]);
      prisma.employee.count.mockResolvedValue(0);

      await listHandler.execute({ page: 1, limit: 10, search: 'سارة' });

      expect(prisma.employee.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ OR: expect.any(Array) }),
        }),
      );
    });
  });

  describe('GetEmployeeHandler', () => {
    it('returns employee with full projection', async () => {
      prisma.employee.findFirst.mockResolvedValue(mockEmployee);

      const result = (await getHandler.execute({ employeeId: 'e1' })) as unknown as {
        id: string;
        specialties: unknown[];
        availability: unknown[];
      };

      expect(result.id).toBe('e1');
      expect(result.specialties).toHaveLength(1);
      expect(result.availability).toHaveLength(1);
    });

    it('throws NotFoundException when not found', async () => {
      prisma.employee.findFirst.mockResolvedValue(null);

      await expect(getHandler.execute({ employeeId: 'e1' })).rejects.toThrow(NotFoundException);
    });
  });
});
