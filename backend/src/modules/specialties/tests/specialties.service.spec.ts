/**
 * CareKit — SpecialtiesService Unit Tests (TDD RED Phase)
 *
 * Tests the SpecialtiesService business logic in isolation:
 *   - findAll — returns only active specialties, sorted by sortOrder
 *   - findOne — returns specialty by ID, throws NotFoundException
 *   - create — validates unique nameEn, default sortOrder, creates record
 *   - update — validates existence, duplicate nameEn check, partial update
 *   - delete — validates existence, cascade protection (active practitioners), hard delete
 *
 * Matches the actual implementation in specialties.service.ts:
 *   - Uses PrismaService for all DB operations
 *   - Throws ConflictException for duplicate nameEn
 *   - Throws ConflictException for delete with active practitioners
 *   - Throws NotFoundException for missing records
 *
 * PrismaService is mocked so tests run without a database.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { SpecialtiesService } from '../specialties.service.js';
import { PrismaService } from '../../../database/prisma.service.js';
import { CreateSpecialtyDto } from '../dto/create-specialty.dto.js';
import { UpdateSpecialtyDto } from '../dto/update-specialty.dto.js';

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

const mockPrismaService = {
  specialty: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const mockSpecialty = {
  id: 'specialty-uuid-1',
  nameEn: 'Cardiology',
  nameAr: 'أمراض القلب',
  descriptionEn: 'Heart and cardiovascular system',
  descriptionAr: 'القلب والجهاز الدوراني',
  iconUrl: 'https://cdn.example.com/icons/cardiology.svg',
  sortOrder: 1,
  isActive: true,
  createdAt: new Date('2026-01-15'),
  updatedAt: new Date('2026-01-15'),
};

const mockSpecialty2 = {
  id: 'specialty-uuid-2',
  nameEn: 'Dermatology',
  nameAr: 'الأمراض الجلدية',
  descriptionEn: 'Skin conditions and treatments',
  descriptionAr: 'الأمراض الجلدية وعلاجها',
  iconUrl: null,
  sortOrder: 2,
  isActive: true,
  createdAt: new Date('2026-01-15'),
  updatedAt: new Date('2026-01-15'),
};

const mockSpecialtyWithPractitioners = {
  ...mockSpecialty,
  practitioners: [{ id: 'practitioner-uuid-1' }],
};

const mockSpecialtyNoPractitioners = {
  ...mockSpecialty,
  practitioners: [],
};

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('SpecialtiesService', () => {
  let service: SpecialtiesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SpecialtiesService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<SpecialtiesService>(SpecialtiesService);

    jest.clearAllMocks();
  });

  // ─────────────────────────────────────────────────────────────
  // findAll
  // ─────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('should return all active specialties sorted by sortOrder ascending', async () => {
      mockPrismaService.specialty.findMany.mockResolvedValue([
        mockSpecialty,
        mockSpecialty2,
      ]);

      const result = await service.findAll();

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(2);
      expect(mockPrismaService.specialty.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      });
    });

    it('should return empty array when no active specialties exist', async () => {
      mockPrismaService.specialty.findMany.mockResolvedValue([]);

      const result = await service.findAll();

      expect(result).toEqual([]);
    });

    it('should only return active specialties (isActive: true filter)', async () => {
      mockPrismaService.specialty.findMany.mockResolvedValue([mockSpecialty]);

      await service.findAll();

      expect(mockPrismaService.specialty.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isActive: true },
        }),
      );
    });
  });

  // ─────────────────────────────────────────────────────────────
  // findOne
  // ─────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('should return a specialty by ID', async () => {
      mockPrismaService.specialty.findUnique.mockResolvedValue(mockSpecialty);

      const result = await service.findOne(mockSpecialty.id);

      expect(result).toBeDefined();
      expect(result.id).toBe(mockSpecialty.id);
      expect(result.nameEn).toBe('Cardiology');
      expect(result.nameAr).toBe('أمراض القلب');
      expect(mockPrismaService.specialty.findUnique).toHaveBeenCalledWith({
        where: { id: mockSpecialty.id },
      });
    });

    it('should throw NotFoundException when specialty does not exist', async () => {
      mockPrismaService.specialty.findUnique.mockResolvedValue(null);

      await expect(service.findOne('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException with descriptive message', async () => {
      mockPrismaService.specialty.findUnique.mockResolvedValue(null);

      await expect(service.findOne('non-existent-id')).rejects.toThrow(
        'Specialty not found',
      );
    });
  });

  // ─────────────────────────────────────────────────────────────
  // create
  // ─────────────────────────────────────────────────────────────

  describe('create', () => {
    const createDto: CreateSpecialtyDto = {
      nameEn: 'Neurology',
      nameAr: 'طب الأعصاب',
      descriptionEn: 'Nervous system disorders',
      descriptionAr: 'اضطرابات الجهاز العصبي',
      iconUrl: 'https://cdn.example.com/icons/neurology.svg',
      sortOrder: 9,
    };

    it('should create a specialty with all fields', async () => {
      mockPrismaService.specialty.findUnique.mockResolvedValue(null); // no duplicate
      mockPrismaService.specialty.create.mockResolvedValue({
        id: 'new-specialty-uuid',
        ...createDto,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.create(createDto);

      expect(result).toBeDefined();
      expect(result.nameEn).toBe(createDto.nameEn);
      expect(mockPrismaService.specialty.create).toHaveBeenCalledWith({
        data: {
          nameEn: createDto.nameEn,
          nameAr: createDto.nameAr,
          descriptionEn: createDto.descriptionEn,
          descriptionAr: createDto.descriptionAr,
          iconUrl: createDto.iconUrl,
          sortOrder: createDto.sortOrder,
        },
      });
    });

    it('should default sortOrder to 0 when not provided', async () => {
      const minimalDto: CreateSpecialtyDto = {
        nameEn: 'Ophthalmology',
        nameAr: 'طب العيون',
      };

      mockPrismaService.specialty.findUnique.mockResolvedValue(null);
      mockPrismaService.specialty.create.mockResolvedValue({
        id: 'new-uuid',
        ...minimalDto,
        sortOrder: 0,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await service.create(minimalDto);

      expect(mockPrismaService.specialty.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          sortOrder: 0,
        }),
      });
    });

    it('should throw ConflictException for duplicate nameEn', async () => {
      mockPrismaService.specialty.findUnique.mockResolvedValue(mockSpecialty); // duplicate found

      await expect(service.create(createDto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw ConflictException with descriptive message for duplicate', async () => {
      mockPrismaService.specialty.findUnique.mockResolvedValue(mockSpecialty);

      await expect(service.create(createDto)).rejects.toThrow(
        'A specialty with this name already exists',
      );
    });

    it('should check uniqueness by nameEn before creating', async () => {
      mockPrismaService.specialty.findUnique.mockResolvedValue(null);
      mockPrismaService.specialty.create.mockResolvedValue({
        id: 'new-uuid',
        ...createDto,
      });

      await service.create(createDto);

      // First findUnique call should check for existing nameEn
      expect(mockPrismaService.specialty.findUnique).toHaveBeenCalledWith({
        where: { nameEn: createDto.nameEn },
      });
    });

    it('should pass optional fields as undefined when not provided', async () => {
      const minimalDto: CreateSpecialtyDto = {
        nameEn: 'Endocrinology',
        nameAr: 'الغدد الصماء',
      };

      mockPrismaService.specialty.findUnique.mockResolvedValue(null);
      mockPrismaService.specialty.create.mockResolvedValue({
        id: 'new-uuid',
        ...minimalDto,
        sortOrder: 0,
      });

      await service.create(minimalDto);

      expect(mockPrismaService.specialty.create).toHaveBeenCalledWith({
        data: {
          nameEn: minimalDto.nameEn,
          nameAr: minimalDto.nameAr,
          descriptionEn: undefined,
          descriptionAr: undefined,
          iconUrl: undefined,
          sortOrder: 0,
        },
      });
    });
  });

  // ─────────────────────────────────────────────────────────────
  // update
  // ─────────────────────────────────────────────────────────────

  describe('update', () => {
    it('should update specialty fields', async () => {
      const updateDto: UpdateSpecialtyDto = {
        descriptionEn: 'Updated cardiology description',
        sortOrder: 15,
      };

      mockPrismaService.specialty.findUnique.mockResolvedValue(mockSpecialty);
      mockPrismaService.specialty.update.mockResolvedValue({
        ...mockSpecialty,
        ...updateDto,
      });

      const result = await service.update(mockSpecialty.id, updateDto);

      expect(result.descriptionEn).toBe('Updated cardiology description');
      expect(result.sortOrder).toBe(15);
      expect(mockPrismaService.specialty.update).toHaveBeenCalledWith({
        where: { id: mockSpecialty.id },
        data: {
          nameEn: undefined,
          nameAr: undefined,
          descriptionEn: updateDto.descriptionEn,
          descriptionAr: undefined,
          iconUrl: undefined,
          sortOrder: updateDto.sortOrder,
          isActive: undefined,
        },
      });
    });

    it('should throw NotFoundException when specialty does not exist', async () => {
      mockPrismaService.specialty.findUnique.mockResolvedValue(null);

      await expect(
        service.update('non-existent-id', { sortOrder: 1 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should allow updating nameEn to a new unique value', async () => {
      mockPrismaService.specialty.findUnique
        .mockResolvedValueOnce(mockSpecialty) // First call: find existing
        .mockResolvedValueOnce(null); // Second call: no duplicate nameEn

      mockPrismaService.specialty.update.mockResolvedValue({
        ...mockSpecialty,
        nameEn: 'Interventional Cardiology',
      });

      const result = await service.update(mockSpecialty.id, {
        nameEn: 'Interventional Cardiology',
      });

      expect(result.nameEn).toBe('Interventional Cardiology');
    });

    it('should throw ConflictException when updating nameEn to an existing name', async () => {
      mockPrismaService.specialty.findUnique
        .mockResolvedValueOnce(mockSpecialty) // First call: find existing
        .mockResolvedValueOnce(mockSpecialty2); // Second call: duplicate found

      await expect(
        service.update(mockSpecialty.id, { nameEn: mockSpecialty2.nameEn }),
      ).rejects.toThrow(ConflictException);
    });

    it('should skip duplicate check when nameEn is unchanged', async () => {
      mockPrismaService.specialty.findUnique.mockResolvedValue(mockSpecialty);
      mockPrismaService.specialty.update.mockResolvedValue({
        ...mockSpecialty,
        sortOrder: 99,
      });

      await service.update(mockSpecialty.id, {
        nameEn: mockSpecialty.nameEn, // same name
        sortOrder: 99,
      });

      // findUnique should only be called once (to check existence, not for duplicate)
      expect(mockPrismaService.specialty.findUnique).toHaveBeenCalledTimes(1);
    });

    it('should skip duplicate check when nameEn is not in the update', async () => {
      mockPrismaService.specialty.findUnique.mockResolvedValue(mockSpecialty);
      mockPrismaService.specialty.update.mockResolvedValue({
        ...mockSpecialty,
        isActive: false,
      });

      await service.update(mockSpecialty.id, { isActive: false });

      // Only one findUnique call for existence check
      expect(mockPrismaService.specialty.findUnique).toHaveBeenCalledTimes(1);
    });

    it('should allow deactivating a specialty', async () => {
      mockPrismaService.specialty.findUnique.mockResolvedValue(mockSpecialty);
      mockPrismaService.specialty.update.mockResolvedValue({
        ...mockSpecialty,
        isActive: false,
      });

      const result = await service.update(mockSpecialty.id, {
        isActive: false,
      });

      expect(result.isActive).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // delete
  // ─────────────────────────────────────────────────────────────

  describe('delete', () => {
    it('should delete a specialty with no active practitioners', async () => {
      mockPrismaService.specialty.findUnique.mockResolvedValue(
        mockSpecialtyNoPractitioners,
      );
      mockPrismaService.specialty.delete.mockResolvedValue(mockSpecialty);

      const result = await service.delete(mockSpecialty.id);

      expect(result).toEqual({ deleted: true });
      expect(mockPrismaService.specialty.delete).toHaveBeenCalledWith({
        where: { id: mockSpecialty.id },
      });
    });

    it('should throw NotFoundException when specialty does not exist', async () => {
      mockPrismaService.specialty.findUnique.mockResolvedValue(null);

      await expect(service.delete('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ConflictException when specialty has active practitioners', async () => {
      mockPrismaService.specialty.findUnique.mockResolvedValue(
        mockSpecialtyWithPractitioners,
      );

      await expect(service.delete(mockSpecialty.id)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw ConflictException with descriptive message for cascade protection', async () => {
      mockPrismaService.specialty.findUnique.mockResolvedValue(
        mockSpecialtyWithPractitioners,
      );

      await expect(service.delete(mockSpecialty.id)).rejects.toThrow(
        'Cannot delete specialty with active practitioners',
      );
    });

    it('should include practitioners in findUnique query for cascade check', async () => {
      mockPrismaService.specialty.findUnique.mockResolvedValue(
        mockSpecialtyNoPractitioners,
      );
      mockPrismaService.specialty.delete.mockResolvedValue(mockSpecialty);

      await service.delete(mockSpecialty.id);

      expect(mockPrismaService.specialty.findUnique).toHaveBeenCalledWith({
        where: { id: mockSpecialty.id },
        include: { practitioners: { where: { deletedAt: null }, take: 1 } },
      });
    });

    it('should only check non-soft-deleted practitioners for cascade protection', async () => {
      // A specialty with only soft-deleted practitioners should be deletable
      mockPrismaService.specialty.findUnique.mockResolvedValue({
        ...mockSpecialty,
        practitioners: [], // Prisma filtered out soft-deleted ones via where: { deletedAt: null }
      });
      mockPrismaService.specialty.delete.mockResolvedValue(mockSpecialty);

      const result = await service.delete(mockSpecialty.id);

      expect(result).toEqual({ deleted: true });
    });

    it('should perform hard delete (not soft delete)', async () => {
      mockPrismaService.specialty.findUnique.mockResolvedValue(
        mockSpecialtyNoPractitioners,
      );
      mockPrismaService.specialty.delete.mockResolvedValue(mockSpecialty);

      await service.delete(mockSpecialty.id);

      // Should call delete, not update with deletedAt
      expect(mockPrismaService.specialty.delete).toHaveBeenCalled();
      expect(mockPrismaService.specialty.update).not.toHaveBeenCalled();
    });
  });
});
