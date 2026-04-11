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

const mockTx: any = {
  user: {
    create: jest.fn().mockResolvedValue(walkInUser),
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  userRole: { create: jest.fn().mockResolvedValue({}) },
  patientProfile: { create: jest.fn().mockResolvedValue({}) },
};

const mockPrisma: any = {
  user: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  role: { findFirst: jest.fn() },
  $transaction: jest.fn((fn: (tx: typeof mockTx) => Promise<unknown>) =>
    fn(mockTx),
  ),
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
    mockTx.user.create.mockResolvedValue(walkInUser);
    mockTx.user.findFirst.mockResolvedValue(null);
    mockTx.user.update.mockResolvedValue({
      ...walkInUser,
      accountType: 'full',
    });
    mockTx.userRole.create.mockResolvedValue({});
    mockTx.patientProfile.create.mockResolvedValue({});
  });

  // ────────────────────────────────────────────
  describe('createWalkIn', () => {
    it('should create a new walk-in user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.role.findFirst.mockResolvedValue(mockRole);

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

      await expect(service.createWalkIn(createDto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw InternalServerErrorException when patient role not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.role.findFirst.mockResolvedValue(null);

      await expect(service.createWalkIn(createDto)).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should create user, userRole, and patientProfile in transaction', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.role.findFirst.mockResolvedValue(mockRole);

      await service.createWalkIn(createDto);

      expect(mockTx.user.create).toHaveBeenCalled();
      expect(mockTx.userRole.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ roleId: mockRole.id }),
        }),
      );
      expect(mockTx.patientProfile.create).toHaveBeenCalled();
    });

    it('creates user with accountType=walk_in and internal email format', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.role.findFirst.mockResolvedValue(mockRole);

      await service.createWalkIn(createDto);

      const userCreateCall = mockTx.user.create.mock.calls[0][0];
      expect(userCreateCall.data.accountType).toBe('walk_in');
      expect(userCreateCall.data.email).toMatch(
        /^walkin_.+@internal\.carekit$/,
      );
    });

    it('creates patientProfile with optional fields when provided', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.role.findFirst.mockResolvedValue(mockRole);
      const dtoWithProfile = {
        ...createDto,
        nationality: 'SA',
        bloodType: 'A_POSITIVE',
        allergies: 'Penicillin',
      };

      await service.createWalkIn(dtoWithProfile as never);

      expect(mockTx.patientProfile.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            nationality: 'SA',
            bloodType: 'A_POSITIVE',
            allergies: 'Penicillin',
          }),
        }),
      );
    });

    it('creates patientProfile with null dateOfBirth when not provided', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.role.findFirst.mockResolvedValue(mockRole);

      await service.createWalkIn(createDto);

      expect(mockTx.patientProfile.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ dateOfBirth: null }),
        }),
      );
    });

    it('links patientProfile to created user id', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.role.findFirst.mockResolvedValue(mockRole);

      await service.createWalkIn(createDto);

      expect(mockTx.patientProfile.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ userId: walkInUser.id }),
        }),
      );
    });

    it('ConflictException includes userId in body for existing full account', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(fullUser);

      try {
        await service.createWalkIn(createDto);
      } catch (e: unknown) {
        expect(e).toBeInstanceOf(ConflictException);
        const conflict = e as ConflictException;
        const response = conflict.getResponse() as Record<string, unknown>;
        expect(response.userId).toBe(fullUser.id);
        expect(response.error).toBe('PATIENT_PHONE_EXISTS');
      }
    });
  });

  // ────────────────────────────────────────────
  describe('claimAccount', () => {
    it('should upgrade walk-in account to full', async () => {
      const updatedUser = {
        ...walkInUser,
        accountType: 'full',
        email: claimDto.email,
      };
      mockPrisma.user.findUnique.mockResolvedValueOnce(walkInUser); // findByPhone
      mockTx.user.findFirst.mockResolvedValue(null); // email not taken
      mockTx.user.update.mockResolvedValue(updatedUser);

      const result = await service.claimAccount(claimDto);

      expect(result.accountType).toBe('full');
      expect(mockTx.user.update).toHaveBeenCalledWith(
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

      await expect(service.claimAccount(claimDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException when account is already full', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(fullUser);

      await expect(service.claimAccount(claimDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ConflictException when email already exists', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(walkInUser); // findByPhone
      mockTx.user.findFirst.mockResolvedValue({ id: 'other-uuid' }); // email taken

      await expect(service.claimAccount(claimDto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('sets emailVerified=false on claim', async () => {
      const updatedUser = {
        ...walkInUser,
        accountType: 'full',
        email: claimDto.email,
      };
      mockPrisma.user.findUnique.mockResolvedValueOnce(walkInUser);
      mockTx.user.findFirst.mockResolvedValue(null);
      mockTx.user.update.mockResolvedValue(updatedUser);

      await service.claimAccount(claimDto);

      expect(mockTx.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ emailVerified: false }),
        }),
      );
    });

    it('sets claimedAt timestamp on claim', async () => {
      const updatedUser = {
        ...walkInUser,
        accountType: 'full',
        email: claimDto.email,
      };
      mockPrisma.user.findUnique.mockResolvedValueOnce(walkInUser);
      mockTx.user.findFirst.mockResolvedValue(null);
      mockTx.user.update.mockResolvedValue(updatedUser);

      await service.claimAccount(claimDto);

      const updateCall = mockTx.user.update.mock.calls[0][0];
      expect(updateCall.data.claimedAt).toBeInstanceOf(Date);
    });

    it('hashes the password before storing', async () => {
      const updatedUser = {
        ...walkInUser,
        accountType: 'full',
        email: claimDto.email,
      };
      mockPrisma.user.findUnique.mockResolvedValueOnce(walkInUser);
      mockTx.user.findFirst.mockResolvedValue(null);
      mockTx.user.update.mockResolvedValue(updatedUser);

      await service.claimAccount(claimDto);

      const updateCall = mockTx.user.update.mock.calls[0][0];
      // Password must be hashed — not stored in plain text
      expect(updateCall.data.passwordHash).toBeDefined();
      expect(updateCall.data.passwordHash).not.toBe(claimDto.password);
    });

    it('NotFoundException error is WALK_IN_NOT_FOUND when phone not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      try {
        await service.claimAccount(claimDto);
      } catch (e: unknown) {
        expect(e).toBeInstanceOf(NotFoundException);
        const err = e as NotFoundException;
        const response = err.getResponse() as Record<string, unknown>;
        expect(response.error).toBe('WALK_IN_NOT_FOUND');
      }
    });

    /**
     * TOCTOU fix: P2002 from concurrent claims is now caught and mapped to ConflictException.
     * The email check runs inside $transaction, and any P2002 that still escapes is caught.
     */
    it('[TOCTOU] maps P2002 from concurrent email claim to ConflictException', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(walkInUser);
      mockTx.user.findFirst.mockResolvedValue(null); // both pass in-memory check

      const p2002 = Object.assign(
        new Error('Unique constraint failed on the fields: (`email`)'),
        {
          code: 'P2002',
          meta: { target: ['email'] },
        },
      );
      mockTx.user.update.mockRejectedValue(p2002);
      // $transaction propagates the error from inside callback
      mockPrisma.$transaction.mockImplementationOnce(
        async (fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx),
      );

      await expect(service.claimAccount(claimDto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  // ────────────────────────────────────────────
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

    it('selects only id and accountType — no sensitive fields', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'x',
        accountType: 'walk_in',
      });

      await service.findWalkInByPhone('0501234567');

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { phone: '0501234567' },
        select: { id: true, accountType: true },
      });
    });
  });
});
