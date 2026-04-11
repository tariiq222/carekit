import { Test } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { EmployeeGender, EmploymentType } from '@prisma/client';
import { CreateEmployeeHandler } from './create-employee.handler';
import { PrismaService } from '../../../infrastructure/database';

const mockEmployee = {
  id: 'e1',
  tenantId: 'tenant-1',
  userId: null,
  name: 'د. سارة الأحمد',
  phone: '0551234567',
  email: 'sara@clinic.com',
  gender: EmployeeGender.FEMALE,
  avatarUrl: null,
  bio: null,
  employmentType: EmploymentType.FULL_TIME,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  specialties: [],
  branches: [],
  services: [],
};

describe('Employees handlers', () => {
  let createHandler: CreateEmployeeHandler;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let prisma: any;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        CreateEmployeeHandler,
        {
          provide: PrismaService,
          useValue: {
            employee: { findUnique: jest.fn(), create: jest.fn() },
          },
        },
      ],
    }).compile();

    createHandler = module.get(CreateEmployeeHandler);
    prisma = module.get(PrismaService);
  });

  describe('CreateEmployeeHandler', () => {
    it('creates employee successfully', async () => {
      prisma.employee.findUnique.mockResolvedValue(null);
      prisma.employee.create.mockResolvedValue(mockEmployee);

      const result = await createHandler.execute({
        tenantId: 'tenant-1',
        name: 'د. سارة الأحمد',
        email: 'sara@clinic.com',
        gender: EmployeeGender.FEMALE,
      });

      expect(result.id).toBe('e1');
      expect(prisma.employee.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ tenantId: 'tenant-1', name: 'د. سارة الأحمد' }),
          include: { specialties: true, branches: true, services: true },
        }),
      );
    });

    it('creates employee with specialties + branches + services', async () => {
      prisma.employee.findUnique.mockResolvedValue(null);
      prisma.employee.create.mockResolvedValue({
        ...mockEmployee,
        specialties: [{ id: 'es1', specialtyId: 'sp1', tenantId: 'tenant-1', employeeId: 'e1' }],
        branches: [{ id: 'eb1', branchId: 'br1', tenantId: 'tenant-1', employeeId: 'e1' }],
      });

      const result = await createHandler.execute({
        tenantId: 'tenant-1',
        name: 'د. سارة الأحمد',
        specialtyIds: ['sp1'],
        branchIds: ['br1'],
      });

      expect(result.specialties).toHaveLength(1);
      expect(result.branches).toHaveLength(1);
      expect(prisma.employee.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            specialties: { create: [{ tenantId: 'tenant-1', specialtyId: 'sp1' }] },
            branches: { create: [{ tenantId: 'tenant-1', branchId: 'br1' }] },
          }),
        }),
      );
    });

    it('skips email uniqueness check when no email provided', async () => {
      prisma.employee.create.mockResolvedValue({ ...mockEmployee, email: null });

      await createHandler.execute({ tenantId: 'tenant-1', name: 'موظف بدون إيميل' });

      expect(prisma.employee.findUnique).not.toHaveBeenCalled();
    });

    it('throws ConflictException when email already registered', async () => {
      prisma.employee.findUnique.mockResolvedValue(mockEmployee);

      await expect(
        createHandler.execute({ tenantId: 'tenant-1', name: 'آخر', email: 'sara@clinic.com' }),
      ).rejects.toThrow(ConflictException);
    });
  });
});
