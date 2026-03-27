/**
 * PatientWalkInService Unit Tests
 */
import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PatientWalkInService } from '../../../src/modules/patients/patient-walk-in.service.js';
import { PrismaService } from '../../../src/database/prisma.service.js';

const mockRole = { id: 'role-uuid', slug: 'patient', isDefault: true };

const walkInUser = {
  id: 'user-uuid-1',
  firstName: 'Rami',
  lastName: 'Alotaibi',
  phone: '0501234567',
  accountType: 'walk_in',
  createdAt: new Date('2026-01-01'),
  email: 'walkin_xxx@internal.carekit',
};

const fullUser = { ...walkInUser, accountType: 'full' };

const createDto = {
  firstName: 'Rami',
  lastName: 'Alotaibi',
  phone: '0501234567',
};

const claimDto = {
  phone: '0501234567',
  email: 'rami@example.com',
  password: 'Secret1234!',
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockTx: any = {
  user: { create: jest.fn().mockResolvedValue(walkInUser) },
  userRole: { create: jest.fn().mockResolvedValue({}) },
  patientProfile: { create: jest.fn().mockResolvedValue({}) },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma: any = {
  user: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  role: { findFirst: jest.fn() },
  $transaction: jest.fn((fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx)),
};

describe('PatientWalkInService', () => {
  let service: PatientWalkInService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PatientWalkInService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<PatientWalkInService>(PatientWalkInService);
    jest.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(
      (fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx),
    );
  });

  describe('createWalkIn', () => {
    it('should create a new walk-in user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.role.findFirst.mockResolvedValue(mockRole);
      mockTx.user.create.mockResolvedValue(walkInUser);

      const result = await service.createWalkIn(createDto);

      expect(result.isExisting).toBe(false);
      expect(result.id).toBe(walkInUser.id);
      expect(result.accountType).toBe('walk_in');
    });

    it('should return existing walk-in user idempotently', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(walkInUser);

      const result = await service.createWalkIn(createDto);

      expect(result.isExisting).toBe(true);
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('should throw ConflictException when phone belongs to a full account', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(fullUser);

      await expect(service.createWalkIn(createDto)).rejects.toThrow(ConflictException);
    });

    it('should throw InternalServerErrorException when patient role not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.role.findFirst.mockResolvedValue(null);

      await expect(service.createWalkIn(createDto)).rejects.toThrow(InternalServerErrorException);
    });

    it('should create user, userRole, and patientProfile in transaction', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.role.findFirst.mockResolvedValue(mockRole);
      mockTx.user.create.mockResolvedValue(walkInUser);

      await service.createWalkIn(createDto);

      expect(mockTx.user.create).toHaveBeenCalled();
      expect(mockTx.userRole.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ roleId: mockRole.id }) }),
      );
      expect(mockTx.patientProfile.create).toHaveBeenCalled();
    });
  });

  describe('claimAccount', () => {
    it('should upgrade walk-in account to full', async () => {
      const updatedUser = { ...walkInUser, accountType: 'full', email: claimDto.email };
      mockPrisma.user.findUnique
        .mockResolvedValueOnce(walkInUser)   // findByPhone
        .mockResolvedValueOnce(null);         // emailTaken check
      mockPrisma.user.update.mockResolvedValue(updatedUser);

      const result = await service.claimAccount(claimDto);

      expect(result.accountType).toBe('full');
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: walkInUser.id },
          data: expect.objectContaining({
            email: claimDto.email,
            accountType: 'full',
          }),
        }),
      );
    });

    it('should throw NotFoundException when phone not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.claimAccount(claimDto)).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when account is already full', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(fullUser);

      await expect(service.claimAccount(claimDto)).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException when email already exists', async () => {
      mockPrisma.user.findUnique
        .mockResolvedValueOnce(walkInUser)         // findByPhone
        .mockResolvedValueOnce({ id: 'other-uuid' }); // emailTaken

      await expect(service.claimAccount(claimDto)).rejects.toThrow(ConflictException);
    });
  });

  describe('findWalkInByPhone', () => {
    it('should return user with id and accountType', async () => {
      const found = { id: walkInUser.id, accountType: 'walk_in' };
      mockPrisma.user.findUnique.mockResolvedValue(found);

      const result = await service.findWalkInByPhone('0501234567');

      expect(result?.id).toBe(walkInUser.id);
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { phone: '0501234567' },
        select: { id: true, accountType: true },
      });
    });

    it('should return null when no user found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      const result = await service.findWalkInByPhone('0000000000');
      expect(result).toBeNull();
    });
  });
});
