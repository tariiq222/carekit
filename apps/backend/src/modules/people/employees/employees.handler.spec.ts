import { Test } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { EmployeeGender, EmploymentType } from '@prisma/client';
import { CreateEmployeeHandler } from './create-employee.handler';
import { PrismaService } from '../../../infrastructure/database';

const mockEmployee = {
  id: 'e1',
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
            employee: { findFirst: jest.fn(), create: jest.fn() },
          },
        },
      ],
    }).compile();

    createHandler = module.get(CreateEmployeeHandler);
    prisma = module.get(PrismaService);
  });

  describe('CreateEmployeeHandler', () => {
    it('creates employee successfully', async () => {
      prisma.employee.findFirst.mockResolvedValue(null);
      prisma.employee.create.mockResolvedValue(mockEmployee);

      const result = await createHandler.execute({
        name: 'د. سارة الأحمد',
        email: 'sara@clinic.com',
        gender: EmployeeGender.FEMALE,
      });

      expect(result.id).toBe('e1');
      expect(prisma.employee.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ name: 'د. سارة الأحمد' }),
          include: { branches: true, services: true },
        }),
      );
    });

    it('creates employee with branches + services', async () => {
      prisma.employee.findFirst.mockResolvedValue(null);
      prisma.employee.create.mockResolvedValue({
        ...mockEmployee,
        branches: [{ id: 'eb1', branchId: 'br1', employeeId: 'e1' }],
      });

      const result = await createHandler.execute({
        name: 'د. سارة الأحمد',
        branchIds: ['br1'],
      });

      expect(result.branches).toHaveLength(1);
      expect(prisma.employee.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            branches: { create: [{ branchId: 'br1' }] },
          }),
        }),
      );
    });

    it('skips email uniqueness check when no email provided', async () => {
      prisma.employee.create.mockResolvedValue({ ...mockEmployee, email: null });

      await createHandler.execute({ name: 'موظف بدون إيميل' });

      expect(prisma.employee.findFirst).not.toHaveBeenCalled();
    });

    it('throws ConflictException when email already registered', async () => {
      prisma.employee.findFirst.mockResolvedValue(mockEmployee);

      await expect(
        createHandler.execute({ name: 'آخر', email: 'sara@clinic.com' }),
      ).rejects.toThrow(ConflictException);
    });
  });
});
