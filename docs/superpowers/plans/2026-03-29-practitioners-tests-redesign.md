# Practitioners Tests Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the broken `practitioners.service.spec.ts` with 6 focused spec files — one per service — so all practitioners tests pass.

**Architecture:** Delete the old monolithic spec. Write a fresh spec per sub-service, each mocking only its own dependencies. Tests follow TDD structure: mock setup → call method → assert result/error.

**Tech Stack:** Jest, `@nestjs/testing`, `ts-jest`, class-validator, PrismaService mock

---

## File Map

| Action | File |
|--------|------|
| DELETE | `backend/src/modules/practitioners/tests/practitioners.service.spec.ts` |
| CREATE | `backend/src/modules/practitioners/tests/practitioners.service.spec.ts` |
| CREATE | `backend/src/modules/practitioners/tests/practitioner-availability.service.spec.ts` |
| CREATE | `backend/src/modules/practitioners/tests/practitioner-vacation.service.spec.ts` |
| CREATE | `backend/src/modules/practitioners/tests/practitioner-breaks.service.spec.ts` |
| CREATE | `backend/src/modules/practitioners/tests/practitioner-service.service.spec.ts` |
| CREATE | `backend/src/modules/practitioners/tests/practitioner-ratings.service.spec.ts` |

---

## Task 1: Delete old spec + write PractitionersService spec

**Files:**
- Delete: `backend/src/modules/practitioners/tests/practitioners.service.spec.ts`
- Create: `backend/src/modules/practitioners/tests/practitioners.service.spec.ts`

- [ ] **Step 1: Delete the old file**

```bash
rm backend/src/modules/practitioners/tests/practitioners.service.spec.ts
```

- [ ] **Step 2: Create the new spec**

Create `backend/src/modules/practitioners/tests/practitioners.service.spec.ts`:

```ts
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
      // specialty should be remapped from specialtyRel
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
```

- [ ] **Step 3: Run the spec**

```bash
cd /Users/tariq/Documents/my_programs/CareKit/backend && npx jest practitioners.service.spec --no-coverage 2>&1 | tail -15
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add backend/src/modules/practitioners/tests/practitioners.service.spec.ts
git commit -m "test(practitioners): rewrite PractitionersService spec — CRUD only"
```

---

## Task 2: PractitionerAvailabilityService spec

**Files:**
- Create: `backend/src/modules/practitioners/tests/practitioner-availability.service.spec.ts`

- [ ] **Step 1: Create the spec**

```ts
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { PractitionerAvailabilityService } from '../practitioner-availability.service.js';
import { PrismaService } from '../../../database/prisma.service.js';
import { BookingSettingsService } from '../../bookings/booking-settings.service.js';

const mockPrisma = {
  practitioner: { findFirst: jest.fn() },
  practitionerAvailability: {
    findMany: jest.fn(),
    deleteMany: jest.fn(),
    createMany: jest.fn(),
  },
  practitionerVacation: { findFirst: jest.fn() },
  practitionerBreak: { findMany: jest.fn() },
  booking: { findMany: jest.fn() },
  $transaction: jest.fn((ops: unknown[]) => Promise.all(ops)),
};

const mockBookingSettings = {
  getForBranch: jest.fn().mockResolvedValue({ bufferMinutes: 0 }),
};

const mockPractitioner = {
  id: 'prac-1',
  userId: 'user-1',
  isAcceptingBookings: true,
  deletedAt: null,
};

const mockAvailability = [
  { id: 'a1', practitionerId: 'prac-1', dayOfWeek: 0, startTime: '09:00', endTime: '12:00', isActive: true },
];

describe('PractitionerAvailabilityService', () => {
  let service: PractitionerAvailabilityService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PractitionerAvailabilityService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: BookingSettingsService, useValue: mockBookingSettings },
      ],
    }).compile();
    service = module.get(PractitionerAvailabilityService);
    jest.clearAllMocks();
    mockBookingSettings.getForBranch.mockResolvedValue({ bufferMinutes: 0 });
  });

  // ── getAvailability ──────────────────────────────────────────

  describe('getAvailability', () => {
    it('returns active availability slots ordered by dayOfWeek then startTime', async () => {
      mockPrisma.practitioner.findFirst.mockResolvedValue(mockPractitioner);
      mockPrisma.practitionerAvailability.findMany.mockResolvedValue(mockAvailability);

      const result = await service.getAvailability('prac-1');

      expect(result).toHaveLength(1);
      expect(result[0].dayOfWeek).toBe(0);
      expect(mockPrisma.practitionerAvailability.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ isActive: true }) }),
      );
    });

    it('throws NotFoundException when practitioner not found', async () => {
      mockPrisma.practitioner.findFirst.mockResolvedValue(null);

      await expect(service.getAvailability('missing')).rejects.toThrow(NotFoundException);
    });
  });

  // ── setAvailability ──────────────────────────────────────────

  describe('setAvailability', () => {
    it('atomically replaces availability schedule', async () => {
      mockPrisma.practitioner.findFirst.mockResolvedValue(mockPractitioner);
      mockPrisma.practitionerAvailability.deleteMany.mockResolvedValue({ count: 1 });
      mockPrisma.practitionerAvailability.createMany.mockResolvedValue({ count: 1 });
      mockPrisma.practitionerAvailability.findMany.mockResolvedValue(mockAvailability);

      await service.setAvailability('prac-1', {
        schedule: [{ dayOfWeek: 0, startTime: '09:00', endTime: '12:00' }],
      });

      expect(mockPrisma.practitionerAvailability.deleteMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { practitionerId: 'prac-1' } }),
      );
      expect(mockPrisma.practitionerAvailability.createMany).toHaveBeenCalled();
    });

    it('rejects invalid dayOfWeek > 6', async () => {
      mockPrisma.practitioner.findFirst.mockResolvedValue(mockPractitioner);

      await expect(
        service.setAvailability('prac-1', {
          schedule: [{ dayOfWeek: 7, startTime: '09:00', endTime: '12:00' }],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects invalid time format', async () => {
      mockPrisma.practitioner.findFirst.mockResolvedValue(mockPractitioner);

      await expect(
        service.setAvailability('prac-1', {
          schedule: [{ dayOfWeek: 1, startTime: '9am', endTime: '12pm' }],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects endTime <= startTime', async () => {
      mockPrisma.practitioner.findFirst.mockResolvedValue(mockPractitioner);

      await expect(
        service.setAvailability('prac-1', {
          schedule: [{ dayOfWeek: 1, startTime: '14:00', endTime: '10:00' }],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects overlapping slots on same day', async () => {
      mockPrisma.practitioner.findFirst.mockResolvedValue(mockPractitioner);

      await expect(
        service.setAvailability('prac-1', {
          schedule: [
            { dayOfWeek: 1, startTime: '09:00', endTime: '14:00' },
            { dayOfWeek: 1, startTime: '13:00', endTime: '17:00' },
          ],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when practitioner not found', async () => {
      mockPrisma.practitioner.findFirst.mockResolvedValue(null);

      await expect(
        service.setAvailability('prac-1', { schedule: [{ dayOfWeek: 0, startTime: '09:00', endTime: '12:00' }] }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── getSlots ─────────────────────────────────────────────────

  describe('getSlots', () => {
    it('returns slots with available flag for a given date', async () => {
      mockPrisma.practitioner.findFirst.mockResolvedValue(mockPractitioner);
      // Sunday 2026-04-05 → dayOfWeek = 0
      mockPrisma.practitionerAvailability.findMany.mockResolvedValue([
        { startTime: '09:00', endTime: '11:00' },
      ]);
      mockPrisma.practitionerVacation.findFirst.mockResolvedValue(null);
      mockPrisma.practitionerBreak.findMany.mockResolvedValue([]);
      mockPrisma.booking.findMany.mockResolvedValue([]);

      const result = await service.getSlots('prac-1', '2026-04-05', 30);

      expect(result.slots.length).toBeGreaterThan(0);
      expect(result.slots[0]).toHaveProperty('available');
      expect(result.date).toBe('2026-04-05');
    });

    it('returns empty slots when practitioner is on vacation', async () => {
      mockPrisma.practitioner.findFirst.mockResolvedValue(mockPractitioner);
      mockPrisma.practitionerAvailability.findMany.mockResolvedValue(mockAvailability);
      mockPrisma.practitionerVacation.findFirst.mockResolvedValue({
        id: 'v1',
        startDate: new Date('2026-04-01'),
        endDate: new Date('2026-04-10'),
      });

      const result = await service.getSlots('prac-1', '2026-04-05', 30);

      expect(result.slots).toHaveLength(0);
    });

    it('marks booked slots as unavailable', async () => {
      mockPrisma.practitioner.findFirst.mockResolvedValue(mockPractitioner);
      mockPrisma.practitionerAvailability.findMany.mockResolvedValue([
        { startTime: '09:00', endTime: '10:00' },
      ]);
      mockPrisma.practitionerVacation.findFirst.mockResolvedValue(null);
      mockPrisma.practitionerBreak.findMany.mockResolvedValue([]);
      mockPrisma.booking.findMany.mockResolvedValue([
        { startTime: '09:00', endTime: '09:30' },
      ]);

      const result = await service.getSlots('prac-1', '2026-04-05', 30);

      const booked = result.slots.find((s: { startTime: string }) => s.startTime === '09:00');
      expect(booked?.available).toBe(false);
    });

    it('returns empty slots when practitioner is not accepting bookings', async () => {
      mockPrisma.practitioner.findFirst.mockResolvedValue({
        ...mockPractitioner,
        isAcceptingBookings: false,
      });

      const result = await service.getSlots('prac-1', '2026-04-05', 30);

      expect(result.slots).toHaveLength(0);
    });

    it('throws BadRequestException when date is missing', async () => {
      await expect(service.getSlots('prac-1', '', 30)).rejects.toThrow(BadRequestException);
    });
  });
});
```

- [ ] **Step 2: Run the spec**

```bash
cd /Users/tariq/Documents/my_programs/CareKit/backend && npx jest practitioner-availability.service.spec --no-coverage 2>&1 | tail -15
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add backend/src/modules/practitioners/tests/practitioner-availability.service.spec.ts
git commit -m "test(practitioners): add PractitionerAvailabilityService spec"
```

---

## Task 3: PractitionerVacationService spec

**Files:**
- Create: `backend/src/modules/practitioners/tests/practitioner-vacation.service.spec.ts`

- [ ] **Step 1: Create the spec**

```ts
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { PractitionerVacationService } from '../practitioner-vacation.service.js';
import { PrismaService } from '../../../database/prisma.service.js';

const mockPrisma = {
  practitioner: { findFirst: jest.fn() },
  practitionerVacation: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
  },
};

const mockPractitioner = { id: 'prac-1', userId: 'user-1', deletedAt: null };

const mockVacation = {
  id: 'vac-1',
  practitionerId: 'prac-1',
  startDate: new Date('2026-04-10'),
  endDate: new Date('2026-04-15'),
  reason: 'إجازة',
};

describe('PractitionerVacationService', () => {
  let service: PractitionerVacationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PractitionerVacationService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get(PractitionerVacationService);
    jest.clearAllMocks();
  });

  // ── getVacations ─────────────────────────────────────────────

  describe('getVacations', () => {
    it('returns vacations ordered by startDate desc', async () => {
      mockPrisma.practitioner.findFirst.mockResolvedValue(mockPractitioner);
      mockPrisma.practitionerVacation.findMany.mockResolvedValue([mockVacation]);

      const result = await service.getVacations('prac-1');

      expect(result).toHaveLength(1);
      expect(mockPrisma.practitionerVacation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { startDate: 'desc' } }),
      );
    });

    it('throws NotFoundException when practitioner not found', async () => {
      mockPrisma.practitioner.findFirst.mockResolvedValue(null);

      await expect(service.getVacations('missing')).rejects.toThrow(NotFoundException);
    });
  });

  // ── createVacation ───────────────────────────────────────────

  describe('createVacation', () => {
    it('creates a vacation record', async () => {
      mockPrisma.practitioner.findFirst.mockResolvedValue(mockPractitioner);
      mockPrisma.practitionerVacation.findMany.mockResolvedValue([]);
      mockPrisma.practitionerVacation.create.mockResolvedValue(mockVacation);

      const result = await service.createVacation('prac-1', {
        startDate: '2026-05-01',
        endDate: '2026-05-05',
      });

      expect(result.id).toBe('vac-1');
    });

    it('rejects when endDate <= startDate', async () => {
      mockPrisma.practitioner.findFirst.mockResolvedValue(mockPractitioner);

      await expect(
        service.createVacation('prac-1', { startDate: '2026-05-05', endDate: '2026-05-01' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects overlapping vacation dates', async () => {
      mockPrisma.practitioner.findFirst.mockResolvedValue(mockPractitioner);
      mockPrisma.practitionerVacation.findMany.mockResolvedValue([mockVacation]);

      // mockVacation is 2026-04-10 → 2026-04-15, new one overlaps
      await expect(
        service.createVacation('prac-1', { startDate: '2026-04-13', endDate: '2026-04-20' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when practitioner not found', async () => {
      mockPrisma.practitioner.findFirst.mockResolvedValue(null);

      await expect(
        service.createVacation('missing', { startDate: '2026-05-01', endDate: '2026-05-05' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── deleteVacation ───────────────────────────────────────────

  describe('deleteVacation', () => {
    it('deletes the vacation record', async () => {
      mockPrisma.practitioner.findFirst.mockResolvedValue(mockPractitioner);
      mockPrisma.practitionerVacation.findUnique.mockResolvedValue(mockVacation);
      mockPrisma.practitionerVacation.delete.mockResolvedValue(mockVacation);

      await service.deleteVacation('prac-1', 'vac-1');

      expect(mockPrisma.practitionerVacation.delete).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'vac-1' } }),
      );
    });

    it('throws NotFoundException when vacation not found', async () => {
      mockPrisma.practitioner.findFirst.mockResolvedValue(mockPractitioner);
      mockPrisma.practitionerVacation.findUnique.mockResolvedValue(null);

      await expect(service.deleteVacation('prac-1', 'missing')).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when vacation belongs to another practitioner', async () => {
      mockPrisma.practitioner.findFirst.mockResolvedValue(mockPractitioner);
      mockPrisma.practitionerVacation.findUnique.mockResolvedValue({
        ...mockVacation,
        practitionerId: 'other-prac',
      });

      await expect(service.deleteVacation('prac-1', 'vac-1')).rejects.toThrow(NotFoundException);
    });
  });
});
```

- [ ] **Step 2: Run the spec**

```bash
cd /Users/tariq/Documents/my_programs/CareKit/backend && npx jest practitioner-vacation.service.spec --no-coverage 2>&1 | tail -15
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add backend/src/modules/practitioners/tests/practitioner-vacation.service.spec.ts
git commit -m "test(practitioners): add PractitionerVacationService spec"
```

---

## Task 4: PractitionerBreaksService spec

**Files:**
- Create: `backend/src/modules/practitioners/tests/practitioner-breaks.service.spec.ts`

- [ ] **Step 1: Create the spec**

```ts
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { PractitionerBreaksService } from '../practitioner-breaks.service.js';
import { PrismaService } from '../../../database/prisma.service.js';

const mockPrisma = {
  practitioner: { findFirst: jest.fn() },
  practitionerBreak: {
    findMany: jest.fn(),
    deleteMany: jest.fn(),
    createMany: jest.fn(),
  },
  practitionerAvailability: { findMany: jest.fn() },
  $transaction: jest.fn(async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => fn(mockPrisma)),
};

const mockPractitioner = { id: 'prac-1', userId: 'user-1', deletedAt: null };

const mockBreaks = [
  { id: 'b1', practitionerId: 'prac-1', dayOfWeek: 1, startTime: '12:00', endTime: '13:00' },
];

const mockAvailability = [
  { practitionerId: 'prac-1', dayOfWeek: 1, startTime: '09:00', endTime: '17:00', isActive: true },
];

describe('PractitionerBreaksService', () => {
  let service: PractitionerBreaksService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PractitionerBreaksService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get(PractitionerBreaksService);
    jest.clearAllMocks();
  });

  // ── getBreaks ────────────────────────────────────────────────

  describe('getBreaks', () => {
    it('returns breaks ordered by dayOfWeek then startTime', async () => {
      mockPrisma.practitioner.findFirst.mockResolvedValue(mockPractitioner);
      mockPrisma.practitionerBreak.findMany.mockResolvedValue(mockBreaks);

      const result = await service.getBreaks('prac-1');

      expect(result).toHaveLength(1);
    });

    it('throws NotFoundException when practitioner not found', async () => {
      mockPrisma.practitioner.findFirst.mockResolvedValue(null);

      await expect(service.getBreaks('missing')).rejects.toThrow(NotFoundException);
    });
  });

  // ── setBreaks ────────────────────────────────────────────────

  describe('setBreaks', () => {
    it('atomically replaces all breaks', async () => {
      mockPrisma.practitioner.findFirst.mockResolvedValue(mockPractitioner);
      mockPrisma.practitionerAvailability.findMany.mockResolvedValue(mockAvailability);
      mockPrisma.practitionerBreak.deleteMany.mockResolvedValue({ count: 1 });
      mockPrisma.practitionerBreak.createMany.mockResolvedValue({ count: 1 });
      mockPrisma.practitionerBreak.findMany.mockResolvedValue(mockBreaks);

      const result = await service.setBreaks('prac-1', {
        breaks: [{ dayOfWeek: 1, startTime: '12:00', endTime: '13:00' }],
      });

      expect(mockPrisma.practitionerBreak.deleteMany).toHaveBeenCalled();
      expect(Array.isArray(result)).toBe(true);
    });

    it('rejects break outside working hours', async () => {
      mockPrisma.practitioner.findFirst.mockResolvedValue(mockPractitioner);
      mockPrisma.practitionerAvailability.findMany.mockResolvedValue(mockAvailability);

      // availability is 09:00-17:00 on day 1; break 18:00-19:00 is outside
      await expect(
        service.setBreaks('prac-1', {
          breaks: [{ dayOfWeek: 1, startTime: '18:00', endTime: '19:00' }],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects overlapping breaks on same day', async () => {
      mockPrisma.practitioner.findFirst.mockResolvedValue(mockPractitioner);
      mockPrisma.practitionerAvailability.findMany.mockResolvedValue(mockAvailability);

      await expect(
        service.setBreaks('prac-1', {
          breaks: [
            { dayOfWeek: 1, startTime: '10:00', endTime: '12:00' },
            { dayOfWeek: 1, startTime: '11:00', endTime: '13:00' },
          ],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects invalid time format', async () => {
      mockPrisma.practitioner.findFirst.mockResolvedValue(mockPractitioner);
      mockPrisma.practitionerAvailability.findMany.mockResolvedValue(mockAvailability);

      await expect(
        service.setBreaks('prac-1', {
          breaks: [{ dayOfWeek: 1, startTime: '10am', endTime: '11am' }],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects endTime <= startTime', async () => {
      mockPrisma.practitioner.findFirst.mockResolvedValue(mockPractitioner);
      mockPrisma.practitionerAvailability.findMany.mockResolvedValue(mockAvailability);

      await expect(
        service.setBreaks('prac-1', {
          breaks: [{ dayOfWeek: 1, startTime: '13:00', endTime: '12:00' }],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('returns empty array when breaks is []', async () => {
      mockPrisma.practitioner.findFirst.mockResolvedValue(mockPractitioner);
      mockPrisma.practitionerAvailability.findMany.mockResolvedValue(mockAvailability);
      mockPrisma.practitionerBreak.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.practitionerBreak.findMany.mockResolvedValue([]);

      const result = await service.setBreaks('prac-1', { breaks: [] });

      expect(result).toEqual([]);
    });
  });
});
```

- [ ] **Step 2: Run the spec**

```bash
cd /Users/tariq/Documents/my_programs/CareKit/backend && npx jest practitioner-breaks.service.spec --no-coverage 2>&1 | tail -15
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add backend/src/modules/practitioners/tests/practitioner-breaks.service.spec.ts
git commit -m "test(practitioners): add PractitionerBreaksService spec"
```

---

## Task 5: PractitionerServiceService spec

**Files:**
- Create: `backend/src/modules/practitioners/tests/practitioner-service.service.spec.ts`

- [ ] **Step 1: Create the spec**

```ts
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { PractitionerServiceService } from '../practitioner-service.service.js';
import { PrismaService } from '../../../database/prisma.service.js';

const mockPrisma = {
  practitioner: { findFirst: jest.fn() },
  service: { findFirst: jest.fn() },
  practitionerService: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  practitionerServiceType: {
    create: jest.fn(),
    findMany: jest.fn(),
    deleteMany: jest.fn(),
  },
  booking: { count: jest.fn() },
};

const mockPractitioner = { id: 'prac-1', userId: 'user-1', deletedAt: null };
const mockService = { id: 'svc-1', nameEn: 'Consultation', nameAr: 'استشارة', deletedAt: null };

const mockPS = {
  id: 'ps-1',
  practitionerId: 'prac-1',
  serviceId: 'svc-1',
  isActive: true,
  customDuration: null,
  bufferMinutes: 0,
  availableTypes: ['in_person'],
};

describe('PractitionerServiceService', () => {
  let service: PractitionerServiceService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PractitionerServiceService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get(PractitionerServiceService);
    jest.clearAllMocks();
  });

  // ── assignService ─────────────────────────────────────────────

  describe('assignService', () => {
    it('assigns a service to practitioner', async () => {
      mockPrisma.practitioner.findFirst.mockResolvedValue(mockPractitioner);
      mockPrisma.service.findFirst.mockResolvedValue(mockService);
      mockPrisma.practitionerService.findUnique.mockResolvedValue(null);
      mockPrisma.practitionerService.create.mockResolvedValue(mockPS);
      mockPrisma.practitionerService.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({ ...mockPS, service: mockService, serviceTypes: [] });

      const result = await service.assignService('prac-1', {
        serviceId: 'svc-1',
        availableTypes: ['in_person'],
      });

      expect(result).toBeDefined();
    });

    it('throws NotFoundException when service not found', async () => {
      mockPrisma.practitioner.findFirst.mockResolvedValue(mockPractitioner);
      mockPrisma.service.findFirst.mockResolvedValue(null);

      await expect(
        service.assignService('prac-1', { serviceId: 'bad', availableTypes: ['in_person'] }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException when service already assigned', async () => {
      mockPrisma.practitioner.findFirst.mockResolvedValue(mockPractitioner);
      mockPrisma.service.findFirst.mockResolvedValue(mockService);
      mockPrisma.practitionerService.findUnique.mockResolvedValue(mockPS);

      await expect(
        service.assignService('prac-1', { serviceId: 'svc-1', availableTypes: ['in_person'] }),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ── listServices ──────────────────────────────────────────────

  describe('listServices', () => {
    it('returns active services for practitioner', async () => {
      mockPrisma.practitioner.findFirst.mockResolvedValue(mockPractitioner);
      mockPrisma.practitionerService.findMany.mockResolvedValue([mockPS]);

      const result = await service.listServices('prac-1');

      expect(result).toHaveLength(1);
      expect(mockPrisma.practitionerService.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ isActive: true }) }),
      );
    });
  });

  // ── removeService ─────────────────────────────────────────────

  describe('removeService', () => {
    it('deletes the practitioner-service assignment', async () => {
      mockPrisma.practitioner.findFirst.mockResolvedValue(mockPractitioner);
      mockPrisma.practitionerService.findUnique.mockResolvedValue(mockPS);
      mockPrisma.booking.count.mockResolvedValue(0);
      mockPrisma.practitionerService.delete.mockResolvedValue(mockPS);

      const result = await service.removeService('prac-1', 'svc-1');

      expect(result).toEqual({ deleted: true });
    });

    it('throws ConflictException when active bookings exist', async () => {
      mockPrisma.practitioner.findFirst.mockResolvedValue(mockPractitioner);
      mockPrisma.practitionerService.findUnique.mockResolvedValue(mockPS);
      mockPrisma.booking.count.mockResolvedValue(2);

      await expect(service.removeService('prac-1', 'svc-1')).rejects.toThrow(ConflictException);
    });

    it('throws NotFoundException when assignment not found', async () => {
      mockPrisma.practitioner.findFirst.mockResolvedValue(mockPractitioner);
      mockPrisma.practitionerService.findUnique.mockResolvedValue(null);

      await expect(service.removeService('prac-1', 'svc-1')).rejects.toThrow(NotFoundException);
    });
  });
});
```

- [ ] **Step 2: Run the spec**

```bash
cd /Users/tariq/Documents/my_programs/CareKit/backend && npx jest practitioner-service.service.spec --no-coverage 2>&1 | tail -15
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add backend/src/modules/practitioners/tests/practitioner-service.service.spec.ts
git commit -m "test(practitioners): add PractitionerServiceService spec"
```

---

## Task 6: PractitionerRatingsService spec

**Files:**
- Create: `backend/src/modules/practitioners/tests/practitioner-ratings.service.spec.ts`

- [ ] **Step 1: Create the spec**

```ts
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PractitionerRatingsService } from '../practitioner-ratings.service.js';
import { PrismaService } from '../../../database/prisma.service.js';

const mockPrisma = {
  practitioner: { findUnique: jest.fn() },
  rating: {
    findMany: jest.fn(),
    count: jest.fn(),
  },
};

const mockPractitioner = { id: 'prac-1', deletedAt: null };

const mockRatings = [
  {
    id: 'r1',
    practitionerId: 'prac-1',
    score: 5,
    comment: 'ممتاز',
    createdAt: new Date('2026-03-01'),
    patient: { firstName: 'أحمد', lastName: 'الغامدي' },
  },
];

describe('PractitionerRatingsService', () => {
  let service: PractitionerRatingsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PractitionerRatingsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get(PractitionerRatingsService);
    jest.clearAllMocks();
  });

  describe('getRatings', () => {
    it('returns paginated ratings', async () => {
      mockPrisma.practitioner.findUnique.mockResolvedValue(mockPractitioner);
      mockPrisma.rating.findMany.mockResolvedValue(mockRatings);
      mockPrisma.rating.count.mockResolvedValue(1);

      const result = await service.getRatings('prac-1', { page: 1, perPage: 10 });

      expect(result.items).toHaveLength(1);
      expect(result.meta).toMatchObject({ page: 1, total: 1 });
    });

    it('anonymizes patient last name to first initial + dot', async () => {
      mockPrisma.practitioner.findUnique.mockResolvedValue(mockPractitioner);
      mockPrisma.rating.findMany.mockResolvedValue(mockRatings);
      mockPrisma.rating.count.mockResolvedValue(1);

      const result = await service.getRatings('prac-1');

      // "الغامدي" → "ا."
      expect(result.items[0].patient?.lastName).toBe('ا.');
      expect(result.items[0].patient?.firstName).toBe('أحمد');
    });

    it('handles null patient gracefully', async () => {
      mockPrisma.practitioner.findUnique.mockResolvedValue(mockPractitioner);
      mockPrisma.rating.findMany.mockResolvedValue([{ ...mockRatings[0], patient: null }]);
      mockPrisma.rating.count.mockResolvedValue(1);

      const result = await service.getRatings('prac-1');

      expect(result.items[0].patient).toBeNull();
    });

    it('throws NotFoundException when practitioner not found', async () => {
      mockPrisma.practitioner.findUnique.mockResolvedValue(null);

      await expect(service.getRatings('missing')).rejects.toThrow(NotFoundException);
    });
  });
});
```

- [ ] **Step 2: Run the spec**

```bash
cd /Users/tariq/Documents/my_programs/CareKit/backend && npx jest practitioner-ratings.service.spec --no-coverage 2>&1 | tail -15
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add backend/src/modules/practitioners/tests/practitioner-ratings.service.spec.ts
git commit -m "test(practitioners): add PractitionerRatingsService spec"
```

---

## Task 7: Final verification

- [ ] **Step 1: Run all practitioners tests**

```bash
cd /Users/tariq/Documents/my_programs/CareKit/backend && npx jest practitioners --no-coverage 2>&1 | tail -20
```

Expected: all suites pass, 0 failures in practitioners.

- [ ] **Step 2: Verify old file is gone**

```bash
ls backend/src/modules/practitioners/tests/
```

Expected: 6 files listed, old monolithic spec NOT present.
