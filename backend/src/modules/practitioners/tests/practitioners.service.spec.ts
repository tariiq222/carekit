import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { PractitionersService } from '../practitioners.service.js';
import { PrismaService } from '../../../database/prisma.service.js';

const mockPrisma = {
  practitioner: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  user: { findUnique: jest.fn() },
  specialty: { findUnique: jest.fn() },
  serviceBookingType: { findUnique: jest.fn() },
  $transaction: jest.fn((fn: (tx: typeof mockPrisma) => Promise<unknown>) => fn(mockPrisma)),
};

const mockUser = {
  id: 'user-1',
  email: 'dr@test.com',
  firstName: 'خالد',
  lastName: 'الفهد',
};

const mockSpecialty = {
  id: 'specialty-1',
  nameEn: 'Cardiology',
  nameAr: 'أمراض القلب',
};

const mockPractitioner = {
  id: 'prac-1',
  userId: mockUser.id,
  specialtyId: mockSpecialty.id,
  specialtyRel: mockSpecialty,
  specialty: 'Cardiology',
  specialtyAr: 'أمراض القلب',
  bio: 'Bio',
  bioAr: 'سيرة',
  experience: 5,
  education: 'MD',
  educationAr: 'دكتوراه',
  rating: 4.5,
  reviewCount: 10,
  isActive: true,
  isAcceptingBookings: true,
  deletedAt: null,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

describe('PractitionersService', () => {
  let service: PractitionersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PractitionersService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get(PractitionersService);
    jest.clearAllMocks();
  });

  // ── findAll ──────────────────────────────────────────────────

  describe('findAll', () => {
    it('returns paginated list with default page=1', async () => {
      mockPrisma.practitioner.findMany.mockResolvedValue([mockPractitioner]);
      mockPrisma.practitioner.count.mockResolvedValue(1);

      const result = await service.findAll({});

      expect(result.items).toHaveLength(1);
      expect(result.meta).toMatchObject({ page: 1, total: 1, totalPages: 1 });
    });

    it('excludes soft-deleted practitioners', async () => {
      mockPrisma.practitioner.findMany.mockResolvedValue([]);
      mockPrisma.practitioner.count.mockResolvedValue(0);

      await service.findAll({});

      expect(mockPrisma.practitioner.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ deletedAt: null }) }),
      );
    });

    it('filters by specialtyId', async () => {
      mockPrisma.practitioner.findMany.mockResolvedValue([]);
      mockPrisma.practitioner.count.mockResolvedValue(0);

      await service.findAll({ specialtyId: mockSpecialty.id });

      expect(mockPrisma.practitioner.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ specialtyId: mockSpecialty.id }) }),
      );
    });

    it('searches by user name', async () => {
      mockPrisma.practitioner.findMany.mockResolvedValue([]);
      mockPrisma.practitioner.count.mockResolvedValue(0);

      await service.findAll({ search: 'خالد' });

      expect(mockPrisma.practitioner.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            user: expect.objectContaining({ OR: expect.any(Array) }),
          }),
        }),
      );
    });
  });

  // ── findOne ──────────────────────────────────────────────────

  describe('findOne', () => {
    it('returns practitioner by id', async () => {
      mockPrisma.practitioner.findFirst.mockResolvedValue(mockPractitioner);

      const result = await service.findOne(mockPractitioner.id);

      expect(result.id).toBe(mockPractitioner.id);
      expect(result).not.toHaveProperty('specialtyRel');
    });

    it('throws NotFoundException when not found', async () => {
      mockPrisma.practitioner.findFirst.mockResolvedValue(null);

      await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
    });
  });

  // ── create ───────────────────────────────────────────────────

  describe('create', () => {
    it('creates practitioner linked to existing user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.specialty.findUnique.mockResolvedValue(mockSpecialty);
      mockPrisma.practitioner.findFirst.mockResolvedValue(null);
      mockPrisma.practitioner.create.mockResolvedValue({ ...mockPractitioner, id: 'new-1' });

      const result = await service.create({
        userId: mockUser.id,
        specialtyId: mockSpecialty.id,
      });

      expect(result.id).toBe('new-1');
      expect(mockPrisma.practitioner.create).toHaveBeenCalled();
    });

    it('throws NotFoundException when user does not exist', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.create({ userId: 'missing' })).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when specialtyId does not exist', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.specialty.findUnique.mockResolvedValue(null);

      await expect(service.create({ userId: mockUser.id, specialtyId: 'bad' })).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException when practitioner already has full profile', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.specialty.findUnique.mockResolvedValue(mockSpecialty);
      mockPrisma.practitioner.findFirst.mockResolvedValue(mockPractitioner);

      await expect(service.create({ userId: mockUser.id, specialtyId: mockSpecialty.id })).rejects.toThrow(ConflictException);
    });
  });

  // ── update ───────────────────────────────────────────────────

  describe('update', () => {
    it('updates practitioner fields', async () => {
      mockPrisma.practitioner.findFirst.mockResolvedValue(mockPractitioner);
      mockPrisma.practitioner.update.mockResolvedValue({ ...mockPractitioner, bio: 'Updated' });

      const result = await service.update(mockPractitioner.id, { bio: 'Updated' });

      expect(result.bio).toBe('Updated');
    });

    it('throws NotFoundException when practitioner not found', async () => {
      mockPrisma.practitioner.findFirst.mockResolvedValue(null);

      await expect(service.update('missing', { bio: 'x' })).rejects.toThrow(NotFoundException);
    });
  });

  // ── delete ───────────────────────────────────────────────────

  describe('delete', () => {
    it('soft-deletes by setting deletedAt and isActive=false', async () => {
      mockPrisma.practitioner.findFirst.mockResolvedValue(mockPractitioner);
      mockPrisma.practitioner.update.mockResolvedValue({});

      await service.delete(mockPractitioner.id);

      expect(mockPrisma.practitioner.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ deletedAt: expect.any(Date), isActive: false }),
        }),
      );
    });

    it('throws NotFoundException when practitioner not found', async () => {
      mockPrisma.practitioner.findFirst.mockResolvedValue(null);

      await expect(service.delete('missing')).rejects.toThrow(NotFoundException);
    });
  });
});
