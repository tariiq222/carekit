/** CareKit — BranchesService Unit Tests */

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { BranchesService } from '../branches.service.js';
import { PrismaService } from '../../../database/prisma.service.js';

const mockPrisma = {
  branch: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  practitioner: { findMany: jest.fn() },
  practitionerBranch: {
    findMany: jest.fn(),
    upsert: jest.fn(),
    deleteMany: jest.fn(),
  },
  $transaction: jest.fn((ops) => Promise.all(ops)),
};

const baseBranch = {
  id: 'branch-1',
  nameAr: 'الفرع الرئيسي',
  nameEn: 'Main Branch',
  address: 'Riyadh',
  phone: '+966501234567',
  email: 'main@clinic.com',
  isMain: true,
  isActive: true,
  timezone: 'Asia/Riyadh',
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  deletedAt: null,
};

describe('BranchesService', () => {
  let service: BranchesService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BranchesService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<BranchesService>(BranchesService);
  });

  // ─────────────────────────────────────────────
  //  findAll
  // ─────────────────────────────────────────────

  describe('findAll', () => {
    it('should return paginated items and meta', async () => {
      mockPrisma.branch.findMany.mockResolvedValue([baseBranch]);
      mockPrisma.branch.count.mockResolvedValue(1);

      const result = await service.findAll({});

      expect(result.items).toHaveLength(1);
      expect(result.meta).toBeDefined();
      expect(result.meta.total).toBe(1);
    });

    it('should strip deletedAt from returned items', async () => {
      mockPrisma.branch.findMany.mockResolvedValue([baseBranch]);
      mockPrisma.branch.count.mockResolvedValue(1);

      const result = await service.findAll({});

      expect(result.items[0]).not.toHaveProperty('deletedAt');
    });

    it('should apply isActive filter when provided', async () => {
      mockPrisma.branch.findMany.mockResolvedValue([]);
      mockPrisma.branch.count.mockResolvedValue(0);

      await service.findAll({ isActive: true });

      expect(mockPrisma.branch.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isActive: true }),
        }),
      );
    });

    it('should apply search filter when provided', async () => {
      mockPrisma.branch.findMany.mockResolvedValue([]);
      mockPrisma.branch.count.mockResolvedValue(0);

      await service.findAll({ search: 'Riyadh' });

      expect(mockPrisma.branch.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ OR: expect.any(Array) }),
        }),
      );
    });
  });

  // ─────────────────────────────────────────────
  //  update
  // ─────────────────────────────────────────────

  describe('update', () => {
    it('should update branch and return result without deletedAt', async () => {
      mockPrisma.branch.findFirst.mockResolvedValue(baseBranch);
      mockPrisma.branch.update.mockResolvedValue({ ...baseBranch, nameEn: 'Updated Branch' });

      const result = await service.update('branch-1', { nameEn: 'Updated Branch' });

      expect(result).not.toHaveProperty('deletedAt');
      expect(result.nameEn).toBe('Updated Branch');
    });

    it('should throw NotFoundException when branch not found', async () => {
      mockPrisma.branch.findFirst.mockResolvedValue(null);

      await expect(service.update('missing-id', { nameEn: 'X' })).rejects.toThrow(NotFoundException);
    });
  });

  // ─────────────────────────────────────────────
  //  findById
  // ─────────────────────────────────────────────

  describe('findById', () => {
    it('should return branch without deletedAt field when branch exists', async () => {
      mockPrisma.branch.findFirst.mockResolvedValue(baseBranch);

      const result = await service.findById('branch-1');

      expect(result).not.toHaveProperty('deletedAt');
      expect(result.id).toBe('branch-1');
      expect(result.nameEn).toBe('Main Branch');
    });

    it('should throw NotFoundException when branch not found', async () => {
      mockPrisma.branch.findFirst.mockResolvedValue(null);

      await expect(service.findById('missing-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─────────────────────────────────────────────
  //  create
  // ─────────────────────────────────────────────

  describe('create', () => {
    it('should create branch with default timezone Asia/Riyadh when no timezone provided', async () => {
      const branchWithTimezone = { ...baseBranch, timezone: 'Asia/Riyadh' };
      mockPrisma.branch.create.mockResolvedValue(branchWithTimezone);

      const dto = {
        nameAr: 'الفرع الرئيسي',
        nameEn: 'Main Branch',
        address: 'Riyadh',
        phone: '+966501234567',
        email: 'main@clinic.com',
      };
      await service.create(dto as never);

      expect(mockPrisma.branch.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ timezone: 'Asia/Riyadh' }),
        }),
      );
    });

    it('should strip deletedAt from returned branch when branch is created', async () => {
      mockPrisma.branch.create.mockResolvedValue(baseBranch);

      const dto = {
        nameAr: 'الفرع الرئيسي',
        nameEn: 'Main Branch',
        address: 'Riyadh',
        phone: '+966501234567',
        email: 'main@clinic.com',
      };
      const result = await service.create(dto as never);

      expect(result).not.toHaveProperty('deletedAt');
    });
  });

  // ─────────────────────────────────────────────
  //  delete
  // ─────────────────────────────────────────────

  describe('delete', () => {
    it('should soft-delete branch by setting deletedAt when branch exists', async () => {
      // ensureExists uses findFirst
      mockPrisma.branch.findFirst.mockResolvedValue(baseBranch);
      mockPrisma.branch.update.mockResolvedValue({
        ...baseBranch,
        deletedAt: new Date(),
      });

      const result = await service.delete('branch-1');

      expect(mockPrisma.branch.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { deletedAt: expect.any(Date) },
        }),
      );
      expect(result).toEqual({ deleted: true });
    });

    it('should throw NotFoundException when branch not found', async () => {
      mockPrisma.branch.findFirst.mockResolvedValue(null);

      await expect(service.delete('missing-id')).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrisma.branch.update).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────
  //  assignPractitioners
  // ─────────────────────────────────────────────

  describe('assignPractitioners', () => {
    it('should assign practitioners via upsert transaction when all exist', async () => {
      mockPrisma.branch.findFirst.mockResolvedValue(baseBranch);
      mockPrisma.practitioner.findMany.mockResolvedValue([
        { id: 'prac-1' },
        { id: 'prac-2' },
      ]);
      mockPrisma.practitionerBranch.upsert.mockResolvedValue({});
      // getPractitioners call
      mockPrisma.practitionerBranch.findMany.mockResolvedValue([]);

      await service.assignPractitioners('branch-1', ['prac-1', 'prac-2']);

      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(mockPrisma.practitionerBranch.upsert).toHaveBeenCalledTimes(2);
    });

    it('should throw BadRequestException when no practitioners are found', async () => {
      mockPrisma.branch.findFirst.mockResolvedValue(baseBranch);
      mockPrisma.practitioner.findMany.mockResolvedValue([]);

      await expect(
        service.assignPractitioners('branch-1', ['prac-missing']),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when some practitioners are missing (partial match)', async () => {
      mockPrisma.branch.findFirst.mockResolvedValue(baseBranch);
      // Only 1 found but 2 requested
      mockPrisma.practitioner.findMany.mockResolvedValue([{ id: 'prac-1' }]);

      await expect(
        service.assignPractitioners('branch-1', ['prac-1', 'prac-missing']),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─────────────────────────────────────────────
  //  removePractitioner
  // ─────────────────────────────────────────────

  describe('removePractitioner', () => {
    it('should remove practitioner from branch when assignment exists', async () => {
      mockPrisma.branch.findFirst.mockResolvedValue(baseBranch);
      mockPrisma.practitionerBranch.deleteMany.mockResolvedValue({ count: 1 });

      const result = await service.removePractitioner('branch-1', 'prac-1');

      expect(mockPrisma.practitionerBranch.deleteMany).toHaveBeenCalledWith({
        where: { branchId: 'branch-1', practitionerId: 'prac-1' },
      });
      expect(result).toEqual({ removed: true });
    });

    it('should throw NotFoundException when practitioner is not assigned to branch', async () => {
      mockPrisma.branch.findFirst.mockResolvedValue(baseBranch);
      mockPrisma.practitionerBranch.deleteMany.mockResolvedValue({ count: 0 });

      await expect(
        service.removePractitioner('branch-1', 'prac-not-assigned'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when branch not found', async () => {
      mockPrisma.branch.findFirst.mockResolvedValue(null);

      await expect(
        service.removePractitioner('missing-branch', 'prac-1'),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrisma.practitionerBranch.deleteMany).not.toHaveBeenCalled();
    });
  });
});
