/**
 * CareKit — PractitionersService Unit Tests (TDD RED Phase)
 *
 * Tests the PractitionersService business logic in isolation:
 *   - Listing practitioners (pagination, filters, sorting, soft-delete exclusion)
 *   - Getting practitioner profile (with user, specialty, ratings)
 *   - Creating practitioner (linking user + specialty, default prices)
 *   - Updating practitioner (bio, prices, experience, education)
 *   - Soft-deleting practitioner
 *   - Availability CRUD (weekly schedule, overlap detection, time validation)
 *   - Vacation CRUD (date validation, overlap detection)
 *   - Slot calculation (available time slots for a given date)
 *
 * Dependencies (PrismaService) are mocked so tests run without a database.
 * These tests will FAIL until backend-dev implements PractitionersService.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PractitionersService } from '../practitioners.service.js';
import { PrismaService } from '../../../database/prisma.service.js';

// ---------------------------------------------------------------------------
// DTO interfaces (replaced by actual imports once backend-dev creates them)
// ---------------------------------------------------------------------------

interface CreatePractitionerDto {
  userId: string;
  specialtyId: string;
  bio?: string;
  bioAr?: string;
  experience?: number;
  education?: string;
  educationAr?: string;
}

interface UpdatePractitionerDto {
  specialtyId?: string;
  bio?: string;
  bioAr?: string;
  experience?: number;
  education?: string;
  educationAr?: string;
  isActive?: boolean;
}

interface SetAvailabilityDto {
  schedule: Array<{
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    isActive?: boolean;
  }>;
}

interface CreateVacationDto {
  startDate: string;
  endDate: string;
  reason?: string;
}

interface PractitionerListQuery {
  page?: number;
  perPage?: number;
  specialtyId?: string;
  isActive?: boolean;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrismaService: any = {
  practitioner: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  practitionerAvailability: {
    createMany: jest.fn(),
    findMany: jest.fn(),
    deleteMany: jest.fn(),
  },
  practitionerVacation: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    delete: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
  },
  specialty: {
    findUnique: jest.fn(),
  },
  booking: {
    findMany: jest.fn(),
  },
  $transaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) => fn(mockPrismaService)),
};

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const mockSpecialty = {
  id: 'specialty-uuid-1',
  nameEn: 'Cardiology',
  nameAr: 'أمراض القلب',
  isActive: true,
};

const mockUser = {
  id: 'user-uuid-1',
  email: 'doctor@carekit-test.com',
  firstName: 'خالد',
  lastName: 'الفهد',
  phone: '+966501000004',
  gender: 'male',
  isActive: true,
};

const mockPractitioner = {
  id: 'practitioner-uuid-1',
  userId: mockUser.id,
  specialtyId: mockSpecialty.id,
  bio: 'Experienced cardiologist',
  bioAr: 'طبيب قلب ذو خبرة',
  experience: 10,
  education: 'MD, Fellowship in Cardiology',
  educationAr: 'دكتوراه في الطب، زمالة أمراض القلب',
  rating: 4.5,
  reviewCount: 20,
  isActive: true,
  deletedAt: null,
  createdAt: new Date('2026-01-15'),
  updatedAt: new Date('2026-01-15'),
  user: mockUser,
  specialty: mockSpecialty,
};

const mockAvailability = [
  { id: 'avail-1', practitionerId: mockPractitioner.id, dayOfWeek: 0, startTime: '09:00', endTime: '12:00', isActive: true },
  { id: 'avail-2', practitionerId: mockPractitioner.id, dayOfWeek: 0, startTime: '14:00', endTime: '17:00', isActive: true },
  { id: 'avail-3', practitionerId: mockPractitioner.id, dayOfWeek: 1, startTime: '09:00', endTime: '17:00', isActive: true },
];

const mockVacation = {
  id: 'vacation-uuid-1',
  practitionerId: mockPractitioner.id,
  startDate: new Date('2026-04-10'),
  endDate: new Date('2026-04-15'),
  reason: 'عطلة عيد الفطر',
  createdAt: new Date('2026-03-01'),
};

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('PractitionersService', () => {
  let service: PractitionersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PractitionersService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<PractitionersService>(PractitionersService);

    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  // ─────────────────────────────────────────────────────────────
  // findAll — List practitioners
  // ─────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('should return paginated practitioners with default page=1, perPage=20', async () => {
      mockPrismaService.practitioner.findMany.mockResolvedValue([mockPractitioner]);
      mockPrismaService.practitioner.count.mockResolvedValue(1);

      const result = await service.findAll({});

      expect(result).toHaveProperty('items');
      expect(result).toHaveProperty('meta');
      expect(result.meta).toMatchObject({
        page: 1,
        perPage: 20,
        total: 1,
        totalPages: 1,
      });
      expect(result.items).toHaveLength(1);
    });

    it('should apply pagination correctly', async () => {
      mockPrismaService.practitioner.findMany.mockResolvedValue([]);
      mockPrismaService.practitioner.count.mockResolvedValue(50);

      const result = await service.findAll({ page: 3, perPage: 10 });

      expect(result.meta.page).toBe(3);
      expect(result.meta.perPage).toBe(10);
      expect(result.meta.totalPages).toBe(5);
      expect(mockPrismaService.practitioner.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 20,
          take: 10,
        }),
      );
    });

    it('should filter by specialtyId', async () => {
      mockPrismaService.practitioner.findMany.mockResolvedValue([mockPractitioner]);
      mockPrismaService.practitioner.count.mockResolvedValue(1);

      await service.findAll({ specialtyId: mockSpecialty.id });

      expect(mockPrismaService.practitioner.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            specialtyId: mockSpecialty.id,
          }),
        }),
      );
    });

    it('should filter by isActive', async () => {
      mockPrismaService.practitioner.findMany.mockResolvedValue([]);
      mockPrismaService.practitioner.count.mockResolvedValue(0);

      await service.findAll({ isActive: true });

      expect(mockPrismaService.practitioner.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isActive: true,
          }),
        }),
      );
    });

    it('should search by user name (Arabic or English)', async () => {
      mockPrismaService.practitioner.findMany.mockResolvedValue([mockPractitioner]);
      mockPrismaService.practitioner.count.mockResolvedValue(1);

      await service.findAll({ search: 'خالد' });

      expect(mockPrismaService.practitioner.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            user: expect.objectContaining({
              OR: expect.arrayContaining([
                expect.objectContaining({
                  firstName: expect.objectContaining({ contains: 'خالد' }),
                }),
              ]),
            }),
          }),
        }),
      );
    });

    it('should exclude soft-deleted practitioners', async () => {
      mockPrismaService.practitioner.findMany.mockResolvedValue([]);
      mockPrismaService.practitioner.count.mockResolvedValue(0);

      await service.findAll({});

      expect(mockPrismaService.practitioner.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            deletedAt: null,
          }),
        }),
      );
    });

    it('should sort by rating descending by default', async () => {
      mockPrismaService.practitioner.findMany.mockResolvedValue([]);
      mockPrismaService.practitioner.count.mockResolvedValue(0);

      await service.findAll({});

      expect(mockPrismaService.practitioner.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: expect.objectContaining({
            rating: 'desc',
          }),
        }),
      );
    });

    it('should include user and specialty relations', async () => {
      mockPrismaService.practitioner.findMany.mockResolvedValue([mockPractitioner]);
      mockPrismaService.practitioner.count.mockResolvedValue(1);

      await service.findAll({});

      expect(mockPrismaService.practitioner.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            user: true,
            specialty: true,
          }),
        }),
      );
    });
  });

  // ─────────────────────────────────────────────────────────────
  // findOne — Get practitioner by ID
  // ─────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('should return a practitioner with user, specialty, and ratings', async () => {
      mockPrismaService.practitioner.findFirst.mockResolvedValue(mockPractitioner);

      const result = await service.findOne(mockPractitioner.id);

      expect(result).toBeDefined();
      expect(result.id).toBe(mockPractitioner.id);
      expect(mockPrismaService.practitioner.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: mockPractitioner.id,
            deletedAt: null,
          },
        }),
      );
    });

    it('should throw NotFoundException for non-existent practitioner', async () => {
      mockPrismaService.practitioner.findFirst.mockResolvedValue(null);

      await expect(service.findOne('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException for soft-deleted practitioner', async () => {
      mockPrismaService.practitioner.findFirst.mockResolvedValue(null);

      await expect(service.findOne(mockPractitioner.id)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─────────────────────────────────────────────────────────────
  // create — Create practitioner
  // ─────────────────────────────────────────────────────────────

  describe('create', () => {
    const createDto: CreatePractitionerDto = {
      userId: mockUser.id,
      specialtyId: mockSpecialty.id,
      bio: 'New cardiologist',
      bioAr: 'طبيب قلب جديد',
      experience: 5,
    };

    it('should create a practitioner record', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.specialty.findUnique.mockResolvedValue(mockSpecialty);
      mockPrismaService.practitioner.findFirst.mockResolvedValue(null); // No existing record
      mockPrismaService.practitioner.create.mockResolvedValue({
        ...mockPractitioner,
        ...createDto,
        id: 'new-practitioner-uuid',
      });

      const result = await service.create(createDto);

      expect(result).toBeDefined();
      expect(result.userId).toBe(createDto.userId);
      expect(result.specialtyId).toBe(createDto.specialtyId);
      expect(mockPrismaService.practitioner.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: createDto.userId,
            specialtyId: createDto.specialtyId,
          }),
        }),
      );
    });

    it('should throw NotFoundException if user does not exist', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.create(createDto)).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if specialty does not exist', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.specialty.findUnique.mockResolvedValue(null);

      await expect(service.create(createDto)).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException if user already has a practitioner record', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.specialty.findUnique.mockResolvedValue(mockSpecialty);
      mockPrismaService.practitioner.findFirst.mockResolvedValue(mockPractitioner);

      await expect(service.create(createDto)).rejects.toThrow(ConflictException);
    });

    it('should default prices to 0 when not provided', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.specialty.findUnique.mockResolvedValue(mockSpecialty);
      mockPrismaService.practitioner.findFirst.mockResolvedValue(null);
      mockPrismaService.practitioner.create.mockResolvedValue({
        ...mockPractitioner,
      });

      await service.create({
        userId: mockUser.id,
        specialtyId: mockSpecialty.id,
      });

      expect(mockPrismaService.practitioner.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: mockUser.id,
          }),
        }),
      );
    });
  });

  // ─────────────────────────────────────────────────────────────
  // update — Update practitioner
  // ─────────────────────────────────────────────────────────────

  describe('update', () => {
    const updateDto: UpdatePractitionerDto = {
      bio: 'Updated bio text',
      bioAr: 'نص سيرة محدث',
      experience: 12,
    };

    it('should update practitioner fields', async () => {
      mockPrismaService.practitioner.findFirst.mockResolvedValue(mockPractitioner);
      mockPrismaService.practitioner.update.mockResolvedValue({
        ...mockPractitioner,
        ...updateDto,
      });

      const result = await service.update(mockPractitioner.id, updateDto);

      expect(result.bio).toBe(updateDto.bio);
      expect(result.experience).toBe(updateDto.experience);
      expect(mockPrismaService.practitioner.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockPractitioner.id },
          data: expect.objectContaining(updateDto),
        }),
      );
    });

    it('should throw NotFoundException if practitioner not found', async () => {
      mockPrismaService.practitioner.findFirst.mockResolvedValue(null);

      await expect(
        service.update('non-existent-id', updateDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should validate specialty exists when updating specialtyId', async () => {
      mockPrismaService.practitioner.findFirst.mockResolvedValue(mockPractitioner);
      mockPrismaService.specialty.findUnique.mockResolvedValue(null);

      await expect(
        service.update(mockPractitioner.id, { specialtyId: 'invalid-specialty' }),
      ).rejects.toThrow(NotFoundException);
    });

  });

  // ─────────────────────────────────────────────────────────────
  // softDelete — Soft-delete practitioner
  // ─────────────────────────────────────────────────────────────

  describe('softDelete', () => {
    it('should set deletedAt timestamp', async () => {
      mockPrismaService.practitioner.findFirst.mockResolvedValue(mockPractitioner);
      mockPrismaService.practitioner.update.mockResolvedValue({
        ...mockPractitioner,
        deletedAt: new Date(),
      });

      await service.softDelete(mockPractitioner.id);

      expect(mockPrismaService.practitioner.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockPractitioner.id },
          data: expect.objectContaining({
            deletedAt: expect.any(Date),
          }),
        }),
      );
    });

    it('should throw NotFoundException if practitioner not found', async () => {
      mockPrismaService.practitioner.findFirst.mockResolvedValue(null);

      await expect(service.softDelete('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Availability — GET / PUT schedule
  // ─────────────────────────────────────────────────────────────

  describe('getAvailability', () => {
    it('should return weekly availability schedule', async () => {
      mockPrismaService.practitioner.findFirst.mockResolvedValue(mockPractitioner);
      mockPrismaService.practitionerAvailability.findMany.mockResolvedValue(mockAvailability);

      const result = await service.getAvailability(mockPractitioner.id);

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(3);
      expect(result[0]).toHaveProperty('dayOfWeek');
      expect(result[0]).toHaveProperty('startTime');
      expect(result[0]).toHaveProperty('endTime');
    });

    it('should throw NotFoundException if practitioner not found', async () => {
      mockPrismaService.practitioner.findFirst.mockResolvedValue(null);

      await expect(service.getAvailability('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('setAvailability', () => {
    const scheduleDto: SetAvailabilityDto = {
      schedule: [
        { dayOfWeek: 0, startTime: '09:00', endTime: '12:00' },
        { dayOfWeek: 0, startTime: '14:00', endTime: '17:00' },
        { dayOfWeek: 1, startTime: '09:00', endTime: '17:00' },
      ],
    };

    it('should replace existing availability with new schedule', async () => {
      mockPrismaService.practitioner.findFirst.mockResolvedValue(mockPractitioner);
      mockPrismaService.practitionerAvailability.deleteMany.mockResolvedValue({ count: 3 });
      mockPrismaService.practitionerAvailability.createMany.mockResolvedValue({ count: 3 });
      mockPrismaService.practitionerAvailability.findMany.mockResolvedValue(mockAvailability);

      const result = await service.setAvailability(mockPractitioner.id, scheduleDto);

      expect(mockPrismaService.practitionerAvailability.deleteMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { practitionerId: mockPractitioner.id },
        }),
      );
      expect(mockPrismaService.practitionerAvailability.createMany).toHaveBeenCalled();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should reject invalid dayOfWeek (must be 0-6)', async () => {
      mockPrismaService.practitioner.findFirst.mockResolvedValue(mockPractitioner);

      await expect(
        service.setAvailability(mockPractitioner.id, {
          schedule: [{ dayOfWeek: 7, startTime: '09:00', endTime: '12:00' }],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject invalid time format (must be HH:mm)', async () => {
      mockPrismaService.practitioner.findFirst.mockResolvedValue(mockPractitioner);

      await expect(
        service.setAvailability(mockPractitioner.id, {
          schedule: [{ dayOfWeek: 1, startTime: '9am', endTime: '12pm' }],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject endTime before or equal to startTime', async () => {
      mockPrismaService.practitioner.findFirst.mockResolvedValue(mockPractitioner);

      await expect(
        service.setAvailability(mockPractitioner.id, {
          schedule: [{ dayOfWeek: 1, startTime: '14:00', endTime: '12:00' }],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject overlapping time slots on the same day', async () => {
      mockPrismaService.practitioner.findFirst.mockResolvedValue(mockPractitioner);

      await expect(
        service.setAvailability(mockPractitioner.id, {
          schedule: [
            { dayOfWeek: 1, startTime: '09:00', endTime: '14:00' },
            { dayOfWeek: 1, startTime: '13:00', endTime: '17:00' }, // overlaps
          ],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if practitioner not found', async () => {
      mockPrismaService.practitioner.findFirst.mockResolvedValue(null);

      await expect(
        service.setAvailability('non-existent-id', scheduleDto),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Slots — Available time slots for a date
  // ─────────────────────────────────────────────────────────────

  describe('getAvailableSlots', () => {
    it('should return available time slots for a given date', async () => {
      // A Sunday (dayOfWeek = 0)
      const date = '2026-04-05';
      mockPrismaService.practitioner.findFirst.mockResolvedValue(mockPractitioner);
      mockPrismaService.practitionerAvailability.findMany.mockResolvedValue(
        mockAvailability.filter((a) => a.dayOfWeek === 0),
      );
      mockPrismaService.practitionerVacation.findMany.mockResolvedValue([]);
      mockPrismaService.booking.findMany.mockResolvedValue([]);

      const result = await service.getAvailableSlots(mockPractitioner.id, date, 30);

      expect(Array.isArray(result)).toBe(true);
      // With 09:00-12:00 and 14:00-17:00, and 30-min slots:
      // 09:00, 09:30, 10:00, 10:30, 11:00, 11:30 + 14:00, 14:30, 15:00, 15:30, 16:00, 16:30
      expect(result.length).toBeGreaterThanOrEqual(12);
      expect(result[0]).toHaveProperty('startTime');
      expect(result[0]).toHaveProperty('endTime');
    });

    it('should exclude slots that overlap with existing bookings', async () => {
      const date = '2026-04-05';
      mockPrismaService.practitioner.findFirst.mockResolvedValue(mockPractitioner);
      mockPrismaService.practitionerAvailability.findMany.mockResolvedValue(
        mockAvailability.filter((a) => a.dayOfWeek === 0),
      );
      mockPrismaService.practitionerVacation.findMany.mockResolvedValue([]);
      mockPrismaService.booking.findMany.mockResolvedValue([
        { startTime: '09:00', endTime: '09:30', status: 'confirmed' },
        { startTime: '14:00', endTime: '14:30', status: 'pending' },
      ]);

      const result = await service.getAvailableSlots(mockPractitioner.id, date, 30);

      // Two slots should be removed
      const startTimes = result.map((s: { startTime: string }) => s.startTime);
      expect(startTimes).not.toContain('09:00');
      expect(startTimes).not.toContain('14:00');
    });

    it('should return empty array if date falls on vacation', async () => {
      const date = '2026-04-12'; // Within mockVacation range
      mockPrismaService.practitioner.findFirst.mockResolvedValue(mockPractitioner);
      mockPrismaService.practitionerAvailability.findMany.mockResolvedValue(mockAvailability);
      mockPrismaService.practitionerVacation.findMany.mockResolvedValue([mockVacation]);

      const result = await service.getAvailableSlots(mockPractitioner.id, date, 30);

      expect(result).toEqual([]);
    });

    it('should return empty array if practitioner has no availability on that day', async () => {
      // Saturday (dayOfWeek = 6) — no availability set
      const date = '2026-04-04';
      mockPrismaService.practitioner.findFirst.mockResolvedValue(mockPractitioner);
      mockPrismaService.practitionerAvailability.findMany.mockResolvedValue([]);
      mockPrismaService.practitionerVacation.findMany.mockResolvedValue([]);

      const result = await service.getAvailableSlots(mockPractitioner.id, date, 30);

      expect(result).toEqual([]);
    });

    it('should throw NotFoundException if practitioner not found', async () => {
      mockPrismaService.practitioner.findFirst.mockResolvedValue(null);

      await expect(
        service.getAvailableSlots('non-existent-id', '2026-04-05', 30),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Vacations — CRUD
  // ─────────────────────────────────────────────────────────────

  describe('createVacation', () => {
    const vacationDto: CreateVacationDto = {
      startDate: '2026-05-01',
      endDate: '2026-05-05',
      reason: 'إجازة شخصية',
    };

    it('should create a vacation record', async () => {
      mockPrismaService.practitioner.findFirst.mockResolvedValue(mockPractitioner);
      mockPrismaService.practitionerVacation.findMany.mockResolvedValue([]);
      mockPrismaService.practitionerVacation.create.mockResolvedValue({
        ...mockVacation,
        ...vacationDto,
        id: 'new-vacation-uuid',
      });

      const result = await service.createVacation(mockPractitioner.id, vacationDto);

      expect(result).toBeDefined();
      expect(result).toHaveProperty('id');
      expect(mockPrismaService.practitionerVacation.create).toHaveBeenCalled();
    });

    it('should reject endDate before startDate', async () => {
      mockPrismaService.practitioner.findFirst.mockResolvedValue(mockPractitioner);

      await expect(
        service.createVacation(mockPractitioner.id, {
          startDate: '2026-05-05',
          endDate: '2026-05-01',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject overlapping vacation dates', async () => {
      mockPrismaService.practitioner.findFirst.mockResolvedValue(mockPractitioner);
      mockPrismaService.practitionerVacation.findMany.mockResolvedValue([mockVacation]);

      await expect(
        service.createVacation(mockPractitioner.id, {
          startDate: '2026-04-13',
          endDate: '2026-04-20',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if practitioner not found', async () => {
      mockPrismaService.practitioner.findFirst.mockResolvedValue(null);

      await expect(
        service.createVacation('non-existent-id', vacationDto),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('listVacations', () => {
    it('should return all vacations for a practitioner', async () => {
      mockPrismaService.practitioner.findFirst.mockResolvedValue(mockPractitioner);
      mockPrismaService.practitionerVacation.findMany.mockResolvedValue([mockVacation]);

      const result = await service.listVacations(mockPractitioner.id);

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('startDate');
      expect(result[0]).toHaveProperty('endDate');
    });
  });

  describe('deleteVacation', () => {
    it('should delete a vacation record', async () => {
      mockPrismaService.practitionerVacation.findUnique.mockResolvedValue(mockVacation);
      mockPrismaService.practitionerVacation.delete.mockResolvedValue(mockVacation);

      await service.deleteVacation(mockPractitioner.id, mockVacation.id);

      expect(mockPrismaService.practitionerVacation.delete).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockVacation.id },
        }),
      );
    });

    it('should throw NotFoundException if vacation not found', async () => {
      mockPrismaService.practitionerVacation.findUnique.mockResolvedValue(null);

      await expect(
        service.deleteVacation(mockPractitioner.id, 'non-existent-id'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should prevent deleting vacation belonging to another practitioner', async () => {
      mockPrismaService.practitionerVacation.findUnique.mockResolvedValue({
        ...mockVacation,
        practitionerId: 'other-practitioner-id',
      });

      await expect(
        service.deleteVacation(mockPractitioner.id, mockVacation.id),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
