# Group Sessions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a complete Group Sessions feature — pre-order group therapy sessions with min/max enrollment, deferred payment on confirmation, and admin management dashboard.

**Architecture:** Single NestJS module `group-sessions/` with 3 sub-services (offerings, sessions, enrollments). Dashboard gets a new `/group-sessions` route with tabs for offerings and sessions. Payment model extended with `groupEnrollmentId`. Three new cron jobs handle enrollment expiry, session cancellation, and reminders.

**Tech Stack:** NestJS 11, Prisma 7, BullMQ, Next.js 15, TanStack Query v5, shadcn/ui, Zod

**Spec:** `docs/superpowers/specs/2026-04-09-group-sessions-design.md`

---

## Phase 1: Database Schema (Backend)

### Task 1: Add Group Session Enums

**Files:**
- Modify: `backend/prisma/schema/enums.prisma`

- [ ] **Step 1: Add GroupSessionStatus and GroupEnrollmentStatus enums**

Add at end of `backend/prisma/schema/enums.prisma`:

```prisma
enum GroupSessionStatus {
  open
  confirmed
  full
  completed
  cancelled

  @@map("group_session_status")
}

enum GroupEnrollmentStatus {
  registered
  confirmed
  attended
  expired
  cancelled

  @@map("group_enrollment_status")
}
```

- [ ] **Step 2: Add group notification types to NotificationType enum**

In `backend/prisma/schema/enums.prisma`, add these values to the `NotificationType` enum before the closing brace:

```prisma
  group_enrollment_created
  group_session_confirmed
  group_payment_confirmed
  group_enrollment_expired
  group_session_cancelled
  group_session_cancelled_admin
  group_session_reminder
```

- [ ] **Step 3: Verify schema compiles**

Run: `cd backend && npx prisma validate`
Expected: "The schemas are valid."

- [ ] **Step 4: Commit**

```bash
git add backend/prisma/schema/enums.prisma
git commit -m "feat(group-sessions): add GroupSessionStatus, GroupEnrollmentStatus enums and notification types"
```

---

### Task 2: Create Group Sessions Prisma Schema

**Files:**
- Create: `backend/prisma/schema/group-sessions.prisma`

- [ ] **Step 1: Create the schema file with all 3 models**

Create `backend/prisma/schema/group-sessions.prisma`:

```prisma
// ──────────────────────────────────────────────
// Group Sessions (pre-order group therapy)
// ──────────────────────────────────────────────

model GroupOffering {
  id                    String    @id @default(uuid())
  clinicId              String    @map("clinic_id")
  employeeId        String    @map("employee_id")
  departmentId          String?   @map("department_id")
  nameAr                String    @map("name_ar")
  nameEn                String    @map("name_en")
  descriptionAr         String?   @map("description_ar")
  descriptionEn         String?   @map("description_en")
  minParticipants       Int       @map("min_participants")
  maxParticipants       Int       @map("max_participants")
  pricePerPersonHalalat Int       @map("price_per_person_halalat")
  durationMin           Int       @map("duration_min")
  paymentDeadlineHours  Int       @default(48) @map("payment_deadline_hours")
  createdAt             DateTime  @default(now()) @map("created_at")
  updatedAt             DateTime  @updatedAt @map("updated_at")
  deletedAt             DateTime? @map("deleted_at")

  clinic       Clinic       @relation(fields: [clinicId], references: [id], onDelete: Restrict)
  employee Employee @relation(fields: [employeeId], references: [id], onDelete: Restrict)
  department   Department?  @relation(fields: [departmentId], references: [id], onDelete: SetNull)
  sessions     GroupSession[]

  @@index([clinicId])
  @@index([employeeId])
  @@map("group_offerings")
}

model GroupSession {
  id                   String             @id @default(uuid())
  groupOfferingId      String             @map("group_offering_id")
  startTime            DateTime           @map("start_time")
  endTime              DateTime           @map("end_time")
  status               GroupSessionStatus @default(open) @map("status")
  currentEnrollment    Int                @default(0) @map("current_enrollment")
  registrationDeadline DateTime           @map("registration_deadline")
  reminderSent         Boolean            @default(false) @map("reminder_sent")
  createdAt            DateTime           @default(now()) @map("created_at")
  updatedAt            DateTime            @updatedAt @map("updated_at")

  groupOffering GroupOffering     @relation(fields: [groupOfferingId], references: [id], onDelete: Restrict)
  enrollments   GroupEnrollment[]

  @@index([groupOfferingId, status])
  @@index([status, registrationDeadline])
  @@map("group_sessions")
}

model GroupEnrollment {
  id                String                @id @default(uuid())
  groupSessionId    String                @map("group_session_id")
  clientId         String                @map("client_id")
  paymentId         String?               @unique @map("payment_id")
  status            GroupEnrollmentStatus @default(registered) @map("status")
  paymentDeadlineAt DateTime?             @map("payment_deadline_at")
  expiredAt         DateTime?             @map("expired_at")
  createdAt         DateTime              @default(now()) @map("created_at")
  updatedAt         DateTime              @updatedAt @map("updated_at")

  groupSession GroupSession @relation(fields: [groupSessionId], references: [id], onDelete: Restrict)
  client      Client      @relation(fields: [clientId], references: [id], onDelete: Restrict)
  payment      Payment?     @relation(fields: [paymentId], references: [id], onDelete: SetNull)

  @@unique([groupSessionId, clientId])
  @@index([status, paymentDeadlineAt])
  @@map("group_enrollments")
}
```

- [ ] **Step 2: Verify schema compiles**

Run: `cd backend && npx prisma validate`
Expected: "The schemas are valid."

Note: This will likely fail because `Clinic`, `Employee`, `Department`, `Client`, and `Payment` models need reverse relation fields. Proceed to Task 3 to add them.

---

### Task 3: Add Reverse Relations to Existing Models

**Files:**
- Modify: `backend/prisma/schema/payments.prisma` (Payment model)
- Modify: Other schema files that define `Clinic`, `Employee`, `Department`, `Client`

- [ ] **Step 1: Find which schema files define the related models**

Run: `cd backend && grep -l "^model Clinic " prisma/schema/*.prisma && grep -l "^model Employee " prisma/schema/*.prisma && grep -l "^model Department " prisma/schema/*.prisma && grep -l "^model Client " prisma/schema/*.prisma`

- [ ] **Step 2: Add reverse relation to Payment model**

In `backend/prisma/schema/payments.prisma`, inside the `Payment` model, add after the `invoice Invoice?` line:

```prisma
  groupEnrollment GroupEnrollment?
```

Note: The FK is on `GroupEnrollment.paymentId` pointing to `Payment.id`, so `Payment` just needs the reverse relation field. No new column on `Payment` table.

- [ ] **Step 3: Add reverse relations to Clinic, Employee, Department, Client**

In each model, add:

```prisma
// On Clinic model:
  groupOfferings GroupOffering[]

// On Employee model:
  groupOfferings GroupOffering[]

// On Department model:
  groupOfferings GroupOffering[]

// On Client model:
  groupEnrollments GroupEnrollment[]
```

- [ ] **Step 4: Validate full schema**

Run: `cd backend && npx prisma validate`
Expected: "The schemas are valid."

- [ ] **Step 5: Generate migration**

Run: `cd backend && npx prisma migrate dev --name add_group_sessions`
Expected: Migration created successfully.

- [ ] **Step 6: Generate Prisma client**

Run: `cd backend && npx prisma generate`
Expected: Generated Prisma Client.

- [ ] **Step 7: Commit**

```bash
git add backend/prisma/schema/ backend/prisma/migrations/
git commit -m "feat(group-sessions): add Prisma schema — GroupOffering, GroupSession, GroupEnrollment"
```

---

## Phase 2: Backend Module — Offerings CRUD

### Task 4: Create DTOs

**Files:**
- Create: `backend/src/modules/group-sessions/dto/create-offering.dto.ts`
- Create: `backend/src/modules/group-sessions/dto/update-offering.dto.ts`
- Create: `backend/src/modules/group-sessions/dto/offering-list-query.dto.ts`

- [ ] **Step 1: Create create-offering.dto.ts**

```typescript
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsInt,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateOfferingDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  @Transform(({ value }) => value?.trim())
  nameAr!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  @Transform(({ value }) => value?.trim())
  nameEn!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  descriptionAr?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  descriptionEn?: string;

  @ApiProperty()
  @IsUUID()
  employeeId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  minParticipants!: number;

  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  maxParticipants!: number;

  @ApiProperty({ description: 'Price per person in halalat (0 = free)', minimum: 0 })
  @IsInt()
  @Min(0)
  pricePerPersonHalalat!: number;

  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  durationMin!: number;

  @ApiPropertyOptional({ default: 48 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(168)
  paymentDeadlineHours?: number;
}
```

- [ ] **Step 2: Create update-offering.dto.ts**

```typescript
import { PartialType } from '@nestjs/swagger';
import { CreateOfferingDto } from './create-offering.dto.js';

export class UpdateOfferingDto extends PartialType(CreateOfferingDto) {}
```

- [ ] **Step 3: Create offering-list-query.dto.ts**

```typescript
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class OfferingListQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  perPage?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  employeeId?: string;
}
```

- [ ] **Step 4: Commit**

```bash
git add backend/src/modules/group-sessions/dto/
git commit -m "feat(group-sessions): add offering DTOs — create, update, list query"
```

---

### Task 5: Create Offerings Service

**Files:**
- Create: `backend/src/modules/group-sessions/group-sessions.service.ts`

- [ ] **Step 1: Write failing test**

Create `backend/test/unit/group-sessions/group-sessions.service.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { GroupSessionsService } from '../../../src/modules/group-sessions/group-sessions.service.js';
import { PrismaService } from '../../../src/database/prisma.service.js';
import { CacheService } from '../../../src/common/services/cache.service.js';
import { NotFoundException } from '@nestjs/common';

describe('GroupSessionsService', () => {
  let service: GroupSessionsService;
  let prisma: { groupOffering: Record<string, jest.Mock> };
  let cache: { del: jest.Mock };

  beforeEach(async () => {
    prisma = {
      groupOffering: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };
    cache = { del: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        GroupSessionsService,
        { provide: PrismaService, useValue: prisma },
        { provide: CacheService, useValue: cache },
      ],
    }).compile();

    service = module.get(GroupSessionsService);
  });

  describe('findAllOfferings', () => {
    it('should return paginated offerings', async () => {
      prisma.groupOffering.findMany.mockResolvedValue([]);
      prisma.groupOffering.count.mockResolvedValue(0);

      const result = await service.findAllOfferings({ page: 1, perPage: 20 });

      expect(result.items).toEqual([]);
      expect(result.meta.total).toBe(0);
      expect(result.meta.page).toBe(1);
    });
  });

  describe('findOneOffering', () => {
    it('should throw NotFoundException when offering not found', async () => {
      prisma.groupOffering.findFirst.mockResolvedValue(null);

      await expect(service.findOneOffering('non-existent-id'))
        .rejects.toThrow(NotFoundException);
    });
  });

  describe('createOffering', () => {
    it('should create and return an offering', async () => {
      const dto = {
        nameAr: 'العلاج بالفن',
        nameEn: 'Art Therapy',
        employeeId: 'pract-1',
        minParticipants: 2,
        maxParticipants: 5,
        pricePerPersonHalalat: 15000,
        durationMin: 90,
      };
      const created = { id: 'off-1', ...dto, clinicId: 'clinic-1' };
      prisma.groupOffering.create.mockResolvedValue(created);

      const result = await service.createOffering(dto);

      expect(result).toEqual(created);
      expect(prisma.groupOffering.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          nameAr: 'العلاج بالفن',
          minParticipants: 2,
        }),
      });
    });
  });

  describe('removeOffering', () => {
    it('should soft delete an offering', async () => {
      prisma.groupOffering.findFirst.mockResolvedValue({ id: 'off-1' });
      prisma.groupOffering.update.mockResolvedValue({ id: 'off-1', deletedAt: new Date() });

      const result = await service.removeOffering('off-1');

      expect(result).toEqual({ deleted: true });
      expect(prisma.groupOffering.update).toHaveBeenCalledWith({
        where: { id: 'off-1' },
        data: { deletedAt: expect.any(Date) },
      });
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx jest test/unit/group-sessions/group-sessions.service.spec.ts --no-coverage`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the service**

Create `backend/src/modules/group-sessions/group-sessions.service.ts`:

```typescript
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { CacheService } from '../../common/services/cache.service.js';
import { CreateOfferingDto } from './dto/create-offering.dto.js';
import { UpdateOfferingDto } from './dto/update-offering.dto.js';
import { OfferingListQueryDto } from './dto/offering-list-query.dto.js';

@Injectable()
export class GroupSessionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async findAllOfferings(query: OfferingListQueryDto) {
    const page = query.page ?? 1;
    const perPage = query.perPage ?? 20;
    const skip = (page - 1) * perPage;

    const where: Record<string, unknown> = { deletedAt: null };
    if (query.employeeId) where.employeeId = query.employeeId;
    if (query.search) {
      where.OR = [
        { nameAr: { contains: query.search, mode: 'insensitive' } },
        { nameEn: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.groupOffering.findMany({
        where,
        include: {
          employee: { select: { id: true, nameAr: true, nameEn: true } },
          _count: {
            select: {
              sessions: { where: { status: { in: ['open', 'confirmed', 'full'] } } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: perPage,
      }),
      this.prisma.groupOffering.count({ where }),
    ]);

    const totalPages = Math.ceil(total / perPage);

    return {
      items,
      meta: {
        total,
        page,
        perPage,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  }

  async findOneOffering(id: string) {
    const offering = await this.prisma.groupOffering.findFirst({
      where: { id, deletedAt: null },
      include: {
        employee: { select: { id: true, nameAr: true, nameEn: true } },
        _count: {
          select: {
            sessions: { where: { status: { in: ['open', 'confirmed', 'full'] } } },
          },
        },
      },
    });

    if (!offering) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Group offering not found',
        error: 'NOT_FOUND',
      });
    }

    return offering;
  }

  async createOffering(dto: CreateOfferingDto) {
    if (dto.minParticipants > dto.maxParticipants) {
      throw new BadRequestException('minParticipants cannot exceed maxParticipants');
    }

    return this.prisma.groupOffering.create({
      data: {
        nameAr: dto.nameAr,
        nameEn: dto.nameEn,
        descriptionAr: dto.descriptionAr,
        descriptionEn: dto.descriptionEn,
        employeeId: dto.employeeId,
        departmentId: dto.departmentId,
        minParticipants: dto.minParticipants,
        maxParticipants: dto.maxParticipants,
        pricePerPersonHalalat: dto.pricePerPersonHalalat,
        durationMin: dto.durationMin,
        paymentDeadlineHours: dto.paymentDeadlineHours ?? 48,
      },
    });
  }

  async updateOffering(id: string, dto: UpdateOfferingDto) {
    await this.findOneOffering(id);

    if (dto.minParticipants !== undefined && dto.maxParticipants !== undefined) {
      if (dto.minParticipants > dto.maxParticipants) {
        throw new BadRequestException('minParticipants cannot exceed maxParticipants');
      }
    }

    return this.prisma.groupOffering.update({
      where: { id },
      data: {
        nameAr: dto.nameAr,
        nameEn: dto.nameEn,
        descriptionAr: dto.descriptionAr,
        descriptionEn: dto.descriptionEn,
        employeeId: dto.employeeId,
        departmentId: dto.departmentId,
        minParticipants: dto.minParticipants,
        maxParticipants: dto.maxParticipants,
        pricePerPersonHalalat: dto.pricePerPersonHalalat,
        durationMin: dto.durationMin,
        paymentDeadlineHours: dto.paymentDeadlineHours,
      },
    });
  }

  async removeOffering(id: string) {
    await this.findOneOffering(id);

    await this.prisma.groupOffering.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return { deleted: true };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx jest test/unit/group-sessions/group-sessions.service.spec.ts --no-coverage`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/group-sessions/group-sessions.service.ts backend/test/unit/group-sessions/
git commit -m "feat(group-sessions): add offerings service — CRUD with pagination, soft-delete"
```

---

### Task 6: Create Sessions Sub-Service

**Files:**
- Create: `backend/src/modules/group-sessions/group-sessions-sessions.service.ts`
- Create: `backend/src/modules/group-sessions/dto/create-session.dto.ts`
- Create: `backend/src/modules/group-sessions/dto/session-list-query.dto.ts`

- [ ] **Step 1: Create create-session.dto.ts**

```typescript
import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty } from 'class-validator';

export class CreateSessionDto {
  @ApiProperty()
  @IsDateString()
  @IsNotEmpty()
  startTime!: string;

  @ApiProperty()
  @IsDateString()
  @IsNotEmpty()
  registrationDeadline!: string;
}
```

- [ ] **Step 2: Create session-list-query.dto.ts**

```typescript
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, IsInt, Min, Max, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';

export class SessionListQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  perPage?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  groupOfferingId?: string;

  @ApiPropertyOptional({ enum: ['open', 'confirmed', 'full', 'completed', 'cancelled'] })
  @IsOptional()
  @IsString()
  status?: string;
}
```

- [ ] **Step 3: Write failing test for sessions service**

Create `backend/test/unit/group-sessions/group-sessions-sessions.service.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { GroupSessionsSessionsService } from '../../../src/modules/group-sessions/group-sessions-sessions.service.js';
import { GroupSessionsService } from '../../../src/modules/group-sessions/group-sessions.service.js';
import { PrismaService } from '../../../src/database/prisma.service.js';
import { NotificationsService } from '../../../src/modules/notifications/notifications.service.js';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('GroupSessionsSessionsService', () => {
  let service: GroupSessionsSessionsService;
  let prisma: Record<string, Record<string, jest.Mock>>;
  let offeringsService: { findOneOffering: jest.Mock };
  let notifications: { createNotification: jest.Mock };

  beforeEach(async () => {
    prisma = {
      groupSession: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      groupEnrollment: {
        updateMany: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
      $transaction: jest.fn((cb) => cb(prisma)),
    };
    offeringsService = { findOneOffering: jest.fn() };
    notifications = { createNotification: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        GroupSessionsSessionsService,
        { provide: GroupSessionsService, useValue: offeringsService },
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationsService, useValue: notifications },
      ],
    }).compile();

    service = module.get(GroupSessionsSessionsService);
  });

  describe('createSession', () => {
    it('should create a session from a valid offering', async () => {
      const offering = {
        id: 'off-1',
        durationMin: 90,
        minParticipants: 2,
        maxParticipants: 5,
      };
      offeringsService.findOneOffering.mockResolvedValue(offering);

      const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const deadline = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
      const dto = {
        startTime: futureDate.toISOString(),
        registrationDeadline: deadline.toISOString(),
      };

      prisma.groupSession.create.mockResolvedValue({
        id: 'sess-1',
        groupOfferingId: 'off-1',
        ...dto,
      });

      const result = await service.createSession('off-1', dto);

      expect(result).toBeDefined();
      expect(prisma.groupSession.create).toHaveBeenCalled();
    });

    it('should reject if deadline is after start time', async () => {
      offeringsService.findOneOffering.mockResolvedValue({ id: 'off-1', durationMin: 90 });

      const start = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
      const deadline = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);

      await expect(
        service.createSession('off-1', {
          startTime: start.toISOString(),
          registrationDeadline: deadline.toISOString(),
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findAllSessions', () => {
    it('should return paginated sessions', async () => {
      const result = await service.findAllSessions({});

      expect(result.items).toEqual([]);
      expect(result.meta.total).toBe(0);
    });
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `cd backend && npx jest test/unit/group-sessions/group-sessions-sessions.service.spec.ts --no-coverage`
Expected: FAIL — module not found.

- [ ] **Step 5: Implement sessions service**

Create `backend/src/modules/group-sessions/group-sessions-sessions.service.ts`:

```typescript
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { GroupSessionsService } from './group-sessions.service.js';
import { CreateSessionDto } from './dto/create-session.dto.js';
import { SessionListQueryDto } from './dto/session-list-query.dto.js';

@Injectable()
export class GroupSessionsSessionsService {
  private readonly logger = new Logger(GroupSessionsSessionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly offeringsService: GroupSessionsService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async createSession(offeringId: string, dto: CreateSessionDto) {
    const offering = await this.offeringsService.findOneOffering(offeringId);

    const startTime = new Date(dto.startTime);
    const endTime = new Date(startTime.getTime() + offering.durationMin * 60 * 1000);
    const deadline = new Date(dto.registrationDeadline);

    if (deadline >= startTime) {
      throw new BadRequestException('Registration deadline must be before session start time');
    }

    if (startTime <= new Date()) {
      throw new BadRequestException('Session start time must be in the future');
    }

    return this.prisma.groupSession.create({
      data: {
        groupOfferingId: offeringId,
        startTime,
        endTime,
        registrationDeadline: deadline,
      },
      include: {
        groupOffering: {
          select: { nameAr: true, nameEn: true, employeeId: true },
        },
      },
    });
  }

  async findAllSessions(query: SessionListQueryDto) {
    const page = query.page ?? 1;
    const perPage = query.perPage ?? 20;
    const skip = (page - 1) * perPage;

    const where: Record<string, unknown> = {};
    if (query.groupOfferingId) where.groupOfferingId = query.groupOfferingId;
    if (query.status) where.status = query.status;

    const [items, total] = await Promise.all([
      this.prisma.groupSession.findMany({
        where,
        include: {
          groupOffering: {
            select: {
              nameAr: true,
              nameEn: true,
              maxParticipants: true,
              minParticipants: true,
              employee: { select: { id: true, nameAr: true, nameEn: true } },
            },
          },
        },
        orderBy: { startTime: 'asc' },
        skip,
        take: perPage,
      }),
      this.prisma.groupSession.count({ where }),
    ]);

    const totalPages = Math.ceil(total / perPage);

    return {
      items,
      meta: {
        total,
        page,
        perPage,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  }

  async findOneSession(id: string) {
    const session = await this.prisma.groupSession.findFirst({
      where: { id },
      include: {
        groupOffering: {
          select: {
            nameAr: true,
            nameEn: true,
            minParticipants: true,
            maxParticipants: true,
            pricePerPersonHalalat: true,
            durationMin: true,
            paymentDeadlineHours: true,
            employee: { select: { id: true, nameAr: true, nameEn: true } },
          },
        },
        enrollments: {
          include: {
            client: { select: { id: true, nameAr: true, nameEn: true, phone: true } },
            payment: { select: { id: true, status: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!session) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Group session not found',
        error: 'NOT_FOUND',
      });
    }

    return session;
  }

  async cancelSession(id: string) {
    const session = await this.findOneSession(id);

    if (session.status === 'completed' || session.status === 'cancelled') {
      throw new BadRequestException(`Cannot cancel a ${session.status} session`);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.groupSession.update({
        where: { id },
        data: { status: 'cancelled' },
      });

      await tx.groupEnrollment.updateMany({
        where: {
          groupSessionId: id,
          status: { in: ['registered', 'confirmed'] },
        },
        data: { status: 'cancelled' },
      });
    });

    for (const enrollment of session.enrollments) {
      if (['registered', 'confirmed'].includes(enrollment.status)) {
        this.notificationsService.createNotification({
          userId: enrollment.clientId,
          titleAr: 'تم إلغاء الجلسة',
          titleEn: 'Session Cancelled',
          bodyAr: `تم إلغاء جلسة "${session.groupOffering.nameAr}" من قبل الإدارة`,
          bodyEn: `"${session.groupOffering.nameEn}" session has been cancelled by admin`,
          type: 'group_session_cancelled_admin',
          data: { groupSessionId: id },
        }).catch((err) => this.logger.warn('Notification failed', { error: (err as Error).message }));
      }
    }

    return { cancelled: true };
  }

  async completeSession(id: string, attendedClientIds: string[]) {
    const session = await this.findOneSession(id);

    if (session.status !== 'confirmed' && session.status !== 'full') {
      throw new BadRequestException(`Cannot complete a ${session.status} session`);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.groupSession.update({
        where: { id },
        data: { status: 'completed' },
      });

      if (attendedClientIds.length > 0) {
        await tx.groupEnrollment.updateMany({
          where: {
            groupSessionId: id,
            clientId: { in: attendedClientIds },
            status: 'confirmed',
          },
          data: { status: 'attended' },
        });
      }
    });

    return { completed: true };
  }
}
```

- [ ] **Step 6: Run tests**

Run: `cd backend && npx jest test/unit/group-sessions/ --no-coverage`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/src/modules/group-sessions/group-sessions-sessions.service.ts backend/src/modules/group-sessions/dto/create-session.dto.ts backend/src/modules/group-sessions/dto/session-list-query.dto.ts backend/test/unit/group-sessions/
git commit -m "feat(group-sessions): add sessions sub-service — schedule, list, cancel, complete"
```

---

### Task 7: Create Enrollments Sub-Service

**Files:**
- Create: `backend/src/modules/group-sessions/group-sessions-enrollments.service.ts`
- Create: `backend/src/modules/group-sessions/dto/enroll-client.dto.ts`
- Create: `backend/src/modules/group-sessions/dto/mark-attendance.dto.ts`

- [ ] **Step 1: Create enroll-client.dto.ts**

```typescript
import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class EnrollClientDto {
  @ApiProperty()
  @IsUUID()
  clientId!: string;
}
```

- [ ] **Step 2: Create mark-attendance.dto.ts**

```typescript
import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsUUID } from 'class-validator';

export class MarkAttendanceDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @IsUUID('4', { each: true })
  attendedClientIds!: string[];
}
```

- [ ] **Step 3: Write failing test for enrollments service**

Create `backend/test/unit/group-sessions/group-sessions-enrollments.service.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { GroupSessionsEnrollmentsService } from '../../../src/modules/group-sessions/group-sessions-enrollments.service.js';
import { PrismaService } from '../../../src/database/prisma.service.js';
import { NotificationsService } from '../../../src/modules/notifications/notifications.service.js';
import { BadRequestException } from '@nestjs/common';

describe('GroupSessionsEnrollmentsService', () => {
  let service: GroupSessionsEnrollmentsService;
  let prisma: Record<string, Record<string, jest.Mock>>;
  let notifications: { createNotification: jest.Mock };

  beforeEach(async () => {
    prisma = {
      groupSession: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      groupEnrollment: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
      groupOffering: {
        findFirst: jest.fn(),
      },
      $transaction: jest.fn((cb) => cb(prisma)),
    };
    notifications = { createNotification: jest.fn().mockResolvedValue({}) };

    const module = await Test.createTestingModule({
      providers: [
        GroupSessionsEnrollmentsService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationsService, useValue: notifications },
      ],
    }).compile();

    service = module.get(GroupSessionsEnrollmentsService);
  });

  describe('enroll', () => {
    it('should reject enrollment in a full session', async () => {
      prisma.groupSession.findFirst.mockResolvedValue({
        id: 'sess-1',
        status: 'full',
        groupOffering: { maxParticipants: 5, minParticipants: 2, pricePerPersonHalalat: 15000 },
      });

      await expect(
        service.enroll('sess-1', 'client-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject duplicate enrollment', async () => {
      prisma.groupSession.findFirst.mockResolvedValue({
        id: 'sess-1',
        status: 'open',
        currentEnrollment: 0,
        groupOffering: { maxParticipants: 5, minParticipants: 2, pricePerPersonHalalat: 15000, paymentDeadlineHours: 48, nameAr: 'test', nameEn: 'test' },
      });
      prisma.groupEnrollment.findFirst.mockResolvedValue({ id: 'enr-1' });

      await expect(
        service.enroll('sess-1', 'client-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('cancelEnrollment', () => {
    it('should reject cancellation of confirmed (paid) enrollment', async () => {
      prisma.groupEnrollment.findFirst.mockResolvedValue({
        id: 'enr-1',
        status: 'confirmed',
        groupSessionId: 'sess-1',
      });

      await expect(
        service.cancelEnrollment('enr-1', 'client-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `cd backend && npx jest test/unit/group-sessions/group-sessions-enrollments.service.spec.ts --no-coverage`
Expected: FAIL — module not found.

- [ ] **Step 5: Implement enrollments service**

Create `backend/src/modules/group-sessions/group-sessions-enrollments.service.ts`:

```typescript
import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';

@Injectable()
export class GroupSessionsEnrollmentsService {
  private readonly logger = new Logger(GroupSessionsEnrollmentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async enroll(sessionId: string, clientId: string) {
    const session = await this.prisma.groupSession.findFirst({
      where: { id: sessionId },
      include: {
        groupOffering: {
          select: {
            nameAr: true,
            nameEn: true,
            minParticipants: true,
            maxParticipants: true,
            pricePerPersonHalalat: true,
            paymentDeadlineHours: true,
          },
        },
      },
    });

    if (!session) {
      throw new NotFoundException('Group session not found');
    }

    if (session.status === 'full' || session.status === 'completed' || session.status === 'cancelled') {
      throw new BadRequestException(`Cannot enroll in a ${session.status} session`);
    }

    const existing = await this.prisma.groupEnrollment.findFirst({
      where: {
        groupSessionId: sessionId,
        clientId,
        status: { notIn: ['cancelled', 'expired'] },
      },
    });

    if (existing) {
      throw new BadRequestException('Client is already enrolled in this session');
    }

    const offering = session.groupOffering;
    const isFree = offering.pricePerPersonHalalat === 0;

    const result = await this.prisma.$transaction(async (tx) => {
      const enrollment = await tx.groupEnrollment.create({
        data: {
          groupSessionId: sessionId,
          clientId,
          status: isFree ? 'confirmed' : 'registered',
        },
      });

      const newCount = session.currentEnrollment + 1;
      let newStatus = session.status;

      if (newCount >= offering.maxParticipants) {
        newStatus = 'full';
      } else if (newCount >= offering.minParticipants && session.status === 'open') {
        newStatus = 'confirmed';
      }

      await tx.groupSession.update({
        where: { id: sessionId },
        data: {
          currentEnrollment: newCount,
          status: newStatus,
        },
      });

      return { enrollment, newStatus, newCount };
    });

    // Notification: enrollment created
    this.notificationsService.createNotification({
      userId: clientId,
      titleAr: `تم تسجيلك في "${offering.nameAr}"`,
      titleEn: `You've been enrolled in "${offering.nameEn}"`,
      bodyAr: isFree ? 'تسجيلك مؤكد — لا يتطلب دفع' : 'سنبلغك عند تأكيد الجلسة للدفع',
      bodyEn: isFree ? 'Your enrollment is confirmed — no payment required' : "We'll notify you when the session is confirmed for payment",
      type: 'group_enrollment_created',
      data: { groupSessionId: sessionId },
    }).catch((err) => this.logger.warn('Notification failed', { error: (err as Error).message }));

    // Session just reached minimum — notify all registered to pay
    if (result.newStatus === 'confirmed' && session.status === 'open' && !isFree) {
      await this.notifySessionConfirmed(sessionId, offering.paymentDeadlineHours);
    }

    return result.enrollment;
  }

  async cancelEnrollment(enrollmentId: string, clientId: string) {
    const enrollment = await this.prisma.groupEnrollment.findFirst({
      where: { id: enrollmentId, clientId },
    });

    if (!enrollment) {
      throw new NotFoundException('Enrollment not found');
    }

    if (enrollment.status !== 'registered') {
      throw new BadRequestException('Can only cancel enrollment before payment');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.groupEnrollment.update({
        where: { id: enrollmentId },
        data: { status: 'cancelled' },
      });

      const session = await tx.groupSession.findFirst({
        where: { id: enrollment.groupSessionId },
        include: { groupOffering: { select: { minParticipants: true, maxParticipants: true } } },
      });

      if (!session) return;

      const newCount = session.currentEnrollment - 1;
      let newStatus = session.status;

      if (newCount < session.groupOffering.minParticipants && session.status !== 'open') {
        newStatus = 'open';
      } else if (newCount < session.groupOffering.maxParticipants && session.status === 'full') {
        newStatus = 'confirmed';
      }

      await tx.groupSession.update({
        where: { id: enrollment.groupSessionId },
        data: { currentEnrollment: newCount, status: newStatus },
      });
    });

    return { cancelled: true };
  }

  async removeEnrollment(enrollmentId: string) {
    const enrollment = await this.prisma.groupEnrollment.findFirst({
      where: { id: enrollmentId },
    });

    if (!enrollment) {
      throw new NotFoundException('Enrollment not found');
    }

    if (enrollment.status === 'confirmed' || enrollment.status === 'attended') {
      throw new BadRequestException('Cannot remove a paid/attended enrollment');
    }

    return this.cancelEnrollment(enrollmentId, enrollment.clientId);
  }

  private async notifySessionConfirmed(sessionId: string, paymentDeadlineHours: number) {
    const enrollments = await this.prisma.groupEnrollment.findMany({
      where: { groupSessionId: sessionId, status: 'registered' },
      select: { id: true, clientId: true },
    });

    const deadlineAt = new Date(Date.now() + paymentDeadlineHours * 60 * 60 * 1000);

    // Set payment deadline for all registered enrollments
    await this.prisma.groupEnrollment.updateMany({
      where: {
        groupSessionId: sessionId,
        status: 'registered',
      },
      data: { paymentDeadlineAt: deadlineAt },
    });

    for (const enrollment of enrollments) {
      this.notificationsService.createNotification({
        userId: enrollment.clientId,
        titleAr: 'الجلسة مؤكدة — أكمل الدفع',
        titleEn: 'Session Confirmed — Complete Payment',
        bodyAr: `الجلسة مؤكدة! أكمل الدفع خلال ${paymentDeadlineHours} ساعة للحفاظ على مكانك`,
        bodyEn: `Session confirmed! Pay within ${paymentDeadlineHours} hours to keep your spot`,
        type: 'group_session_confirmed',
        data: { groupSessionId: sessionId, enrollmentId: enrollment.id },
      }).catch((err) => this.logger.warn('Notification failed', { error: (err as Error).message }));
    }
  }
}
```

- [ ] **Step 6: Run tests**

Run: `cd backend && npx jest test/unit/group-sessions/ --no-coverage`
Expected: PASS (all tests).

- [ ] **Step 7: Commit**

```bash
git add backend/src/modules/group-sessions/group-sessions-enrollments.service.ts backend/src/modules/group-sessions/dto/enroll-client.dto.ts backend/src/modules/group-sessions/dto/mark-attendance.dto.ts backend/test/unit/group-sessions/
git commit -m "feat(group-sessions): add enrollments sub-service — enroll, cancel, remove, state transitions"
```

---

### Task 8: Create Controller & Module Registration

**Files:**
- Create: `backend/src/modules/group-sessions/group-sessions.controller.ts`
- Create: `backend/src/modules/group-sessions/group-sessions.module.ts`
- Modify: `backend/src/app.module.ts`

- [ ] **Step 1: Create the controller**

Create `backend/src/modules/group-sessions/group-sessions.controller.ts`:

```typescript
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../../common/guards/permissions.guard.js';
import { FeatureFlagGuard } from '../../common/guards/feature-flag.guard.js';
import { CheckPermissions } from '../../common/decorators/check-permissions.decorator.js';
import { RequireFeature } from '../../common/decorators/require-feature.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { GroupSessionsService } from './group-sessions.service.js';
import { GroupSessionsSessionsService } from './group-sessions-sessions.service.js';
import { GroupSessionsEnrollmentsService } from './group-sessions-enrollments.service.js';
import { CreateOfferingDto } from './dto/create-offering.dto.js';
import { UpdateOfferingDto } from './dto/update-offering.dto.js';
import { OfferingListQueryDto } from './dto/offering-list-query.dto.js';
import { CreateSessionDto } from './dto/create-session.dto.js';
import { SessionListQueryDto } from './dto/session-list-query.dto.js';
import { EnrollClientDto } from './dto/enroll-client.dto.js';
import { MarkAttendanceDto } from './dto/mark-attendance.dto.js';

@ApiTags('Group Sessions')
@ApiBearerAuth()
@Controller('group-sessions')
@UseGuards(JwtAuthGuard, PermissionsGuard, FeatureFlagGuard)
@RequireFeature('group_sessions')
export class GroupSessionsController {
  constructor(
    private readonly offeringsService: GroupSessionsService,
    private readonly sessionsService: GroupSessionsSessionsService,
    private readonly enrollmentsService: GroupSessionsEnrollmentsService,
  ) {}

  // ─── Offerings ───

  @Get('offerings')
  @Public()
  @ApiOperation({ summary: 'List group offerings' })
  findAllOfferings(@Query() query: OfferingListQueryDto) {
    return this.offeringsService.findAllOfferings(query);
  }

  @Get('offerings/:id')
  @Public()
  @ApiOperation({ summary: 'Get group offering by ID' })
  findOneOffering(@Param('id', ParseUUIDPipe) id: string) {
    return this.offeringsService.findOneOffering(id);
  }

  @Post('offerings')
  @ApiOperation({ summary: 'Create group offering' })
  @CheckPermissions({ module: 'group_sessions', action: 'create' })
  createOffering(@Body() dto: CreateOfferingDto) {
    return this.offeringsService.createOffering(dto);
  }

  @Patch('offerings/:id')
  @ApiOperation({ summary: 'Update group offering' })
  @CheckPermissions({ module: 'group_sessions', action: 'edit' })
  updateOffering(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOfferingDto,
  ) {
    return this.offeringsService.updateOffering(id, dto);
  }

  @Delete('offerings/:id')
  @ApiOperation({ summary: 'Soft delete group offering' })
  @CheckPermissions({ module: 'group_sessions', action: 'delete' })
  removeOffering(@Param('id', ParseUUIDPipe) id: string) {
    return this.offeringsService.removeOffering(id);
  }

  // ─── Sessions ───

  @Post('offerings/:id/sessions')
  @ApiOperation({ summary: 'Schedule a session for an offering' })
  @CheckPermissions({ module: 'group_sessions', action: 'create' })
  createSession(
    @Param('id', ParseUUIDPipe) offeringId: string,
    @Body() dto: CreateSessionDto,
  ) {
    return this.sessionsService.createSession(offeringId, dto);
  }

  @Get('sessions')
  @Public()
  @ApiOperation({ summary: 'List all group sessions' })
  findAllSessions(@Query() query: SessionListQueryDto) {
    return this.sessionsService.findAllSessions(query);
  }

  @Get('sessions/:id')
  @Public()
  @ApiOperation({ summary: 'Get session detail with enrollments' })
  findOneSession(@Param('id', ParseUUIDPipe) id: string) {
    return this.sessionsService.findOneSession(id);
  }

  @Patch('sessions/:id/cancel')
  @ApiOperation({ summary: 'Cancel a group session (admin)' })
  @CheckPermissions({ module: 'group_sessions', action: 'edit' })
  cancelSession(@Param('id', ParseUUIDPipe) id: string) {
    return this.sessionsService.cancelSession(id);
  }

  @Post('sessions/:id/attendance')
  @ApiOperation({ summary: 'Mark attendance and complete session' })
  @CheckPermissions({ module: 'group_sessions', action: 'edit' })
  completeSession(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MarkAttendanceDto,
  ) {
    return this.sessionsService.completeSession(id, dto.attendedClientIds);
  }

  // ─── Enrollments ───

  @Post('sessions/:id/enroll')
  @ApiOperation({ summary: 'Enroll a client in a session' })
  enrollClient(
    @Param('id', ParseUUIDPipe) sessionId: string,
    @Body() dto: EnrollClientDto,
  ) {
    return this.enrollmentsService.enroll(sessionId, dto.clientId);
  }

  @Patch('sessions/:sessionId/enrollments/:enrollmentId/cancel')
  @ApiOperation({ summary: 'Client cancels own enrollment (pre-payment only)' })
  cancelEnrollment(
    @Param('enrollmentId', ParseUUIDPipe) enrollmentId: string,
    @Body() dto: EnrollClientDto,
  ) {
    return this.enrollmentsService.cancelEnrollment(enrollmentId, dto.clientId);
  }

  @Delete('sessions/:sessionId/enrollments/:enrollmentId')
  @ApiOperation({ summary: 'Admin removes enrollment (pre-payment only)' })
  @CheckPermissions({ module: 'group_sessions', action: 'edit' })
  removeEnrollment(
    @Param('enrollmentId', ParseUUIDPipe) enrollmentId: string,
  ) {
    return this.enrollmentsService.removeEnrollment(enrollmentId);
  }
}
```

- [ ] **Step 2: Create the module**

Create `backend/src/modules/group-sessions/group-sessions.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { FeatureFlagsModule } from '../feature-flags/feature-flags.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { GroupSessionsController } from './group-sessions.controller.js';
import { GroupSessionsService } from './group-sessions.service.js';
import { GroupSessionsSessionsService } from './group-sessions-sessions.service.js';
import { GroupSessionsEnrollmentsService } from './group-sessions-enrollments.service.js';

@Module({
  imports: [FeatureFlagsModule, NotificationsModule],
  controllers: [GroupSessionsController],
  providers: [
    GroupSessionsService,
    GroupSessionsSessionsService,
    GroupSessionsEnrollmentsService,
  ],
  exports: [
    GroupSessionsService,
    GroupSessionsSessionsService,
    GroupSessionsEnrollmentsService,
  ],
})
export class GroupSessionsModule {}
```

- [ ] **Step 3: Register in app.module.ts**

In `backend/src/app.module.ts`, add import and register:

```typescript
// Add import at top:
import { GroupSessionsModule } from './modules/group-sessions/group-sessions.module.js';

// Add to imports array (after DepartmentsModule):
GroupSessionsModule,
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd backend && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 5: Run all group-sessions tests**

Run: `cd backend && npx jest test/unit/group-sessions/ --no-coverage`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/src/modules/group-sessions/ backend/src/app.module.ts
git commit -m "feat(group-sessions): add controller, module registration — full backend API"
```

---

## Phase 3: Cron Jobs

### Task 9: Add Group Session Cron Jobs

**Files:**
- Create: `backend/src/modules/tasks/group-session-automation.service.ts`
- Modify: `backend/src/modules/tasks/tasks-bootstrap.service.ts`
- Modify: `backend/src/modules/tasks/tasks.processor.ts`
- Modify: `backend/src/modules/tasks/tasks.module.ts` (if needed for DI)

- [ ] **Step 1: Create the automation service**

Create `backend/src/modules/tasks/group-session-automation.service.ts`:

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';

@Injectable()
export class GroupSessionAutomationService {
  private readonly logger = new Logger(GroupSessionAutomationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /** Expire enrollments that missed their payment deadline */
  async expireUnpaidEnrollments(): Promise<void> {
    const expired = await this.prisma.groupEnrollment.findMany({
      where: {
        status: 'registered',
        paymentDeadlineAt: { not: null, lt: new Date() },
      },
      select: {
        id: true,
        clientId: true,
        groupSessionId: true,
        groupSession: {
          select: {
            id: true,
            currentEnrollment: true,
            status: true,
            groupOffering: {
              select: { minParticipants: true, maxParticipants: true, nameAr: true, nameEn: true },
            },
          },
        },
      },
    });

    for (const enrollment of expired) {
      try {
        await this.prisma.$transaction(async (tx) => {
          const current = await tx.groupEnrollment.findFirst({
            where: { id: enrollment.id, status: 'registered' },
          });
          if (!current) return;

          await tx.groupEnrollment.update({
            where: { id: enrollment.id },
            data: { status: 'expired', expiredAt: new Date() },
          });

          const session = enrollment.groupSession;
          const newCount = session.currentEnrollment - 1;
          let newStatus = session.status;

          if (newCount < session.groupOffering.minParticipants && newStatus !== 'open') {
            newStatus = 'open';
          } else if (newCount < session.groupOffering.maxParticipants && newStatus === 'full') {
            newStatus = 'confirmed';
          }

          await tx.groupSession.update({
            where: { id: session.id },
            data: { currentEnrollment: newCount, status: newStatus },
          });
        }, { isolationLevel: 'Serializable', timeout: 10000 });

        this.notificationsService.createNotification({
          userId: enrollment.clientId,
          titleAr: 'انتهت مهلة الدفع',
          titleEn: 'Payment Deadline Expired',
          bodyAr: 'انتهت مهلة الدفع — فقدت مكانك في الجلسة',
          bodyEn: 'Payment deadline has passed — you lost your spot',
          type: 'group_enrollment_expired',
          data: { groupSessionId: enrollment.groupSessionId },
        }).catch((err) => this.logger.warn('Notification failed', { error: (err as Error).message }));
      } catch (err) {
        this.logger.warn(`Failed to expire enrollment ${enrollment.id}: ${(err as Error).message}`);
      }
    }

    if (expired.length > 0) {
      this.logger.log(`Expired ${expired.length} unpaid group enrollments`);
    }
  }

  /** Cancel sessions that didn't reach minimum before registration deadline */
  async cancelIncompleteSessiones(): Promise<void> {
    const sessions = await this.prisma.groupSession.findMany({
      where: {
        status: 'open',
        registrationDeadline: { lt: new Date() },
      },
      include: {
        groupOffering: { select: { nameAr: true, nameEn: true } },
        enrollments: {
          where: { status: 'registered' },
          select: { id: true, clientId: true },
        },
      },
    });

    for (const session of sessions) {
      try {
        await this.prisma.$transaction(async (tx) => {
          await tx.groupSession.update({
            where: { id: session.id },
            data: { status: 'cancelled' },
          });

          await tx.groupEnrollment.updateMany({
            where: { groupSessionId: session.id, status: 'registered' },
            data: { status: 'cancelled' },
          });
        });

        for (const enrollment of session.enrollments) {
          this.notificationsService.createNotification({
            userId: enrollment.clientId,
            titleAr: 'تم إلغاء الجلسة',
            titleEn: 'Session Cancelled',
            bodyAr: `تم إلغاء جلسة "${session.groupOffering.nameAr}" لعدم اكتمال العدد`,
            bodyEn: `"${session.groupOffering.nameEn}" session cancelled due to insufficient enrollment`,
            type: 'group_session_cancelled',
            data: { groupSessionId: session.id },
          }).catch((err) => this.logger.warn('Notification failed', { error: (err as Error).message }));
        }
      } catch (err) {
        this.logger.warn(`Failed to cancel session ${session.id}: ${(err as Error).message}`);
      }
    }

    if (sessions.length > 0) {
      this.logger.log(`Cancelled ${sessions.length} incomplete group sessions`);
    }
  }

  /** Send reminders 24h before confirmed sessions */
  async sendSessionReminders(): Promise<void> {
    const now = new Date();
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const sessions = await this.prisma.groupSession.findMany({
      where: {
        status: { in: ['confirmed', 'full'] },
        startTime: { gt: now, lte: in24h },
        reminderSent: false,
      },
      include: {
        groupOffering: { select: { nameAr: true, nameEn: true } },
        enrollments: {
          where: { status: 'confirmed' },
          select: { clientId: true },
        },
      },
    });

    for (const session of sessions) {
      for (const enrollment of session.enrollments) {
        this.notificationsService.createNotification({
          userId: enrollment.clientId,
          titleAr: 'تذكير: جلسة غداً',
          titleEn: 'Reminder: Session Tomorrow',
          bodyAr: `جلسة "${session.groupOffering.nameAr}" غداً`,
          bodyEn: `"${session.groupOffering.nameEn}" session is tomorrow`,
          type: 'group_session_reminder',
          data: { groupSessionId: session.id },
        }).catch((err) => this.logger.warn('Notification failed', { error: (err as Error).message }));
      }

      await this.prisma.groupSession.update({
        where: { id: session.id },
        data: { reminderSent: true },
      });
    }

    if (sessions.length > 0) {
      this.logger.log(`Sent reminders for ${sessions.length} group sessions`);
    }
  }
}
```

- [ ] **Step 2: Add jobs to DESIRED_JOBS in tasks-bootstrap.service.ts**

In `backend/src/modules/tasks/tasks-bootstrap.service.ts`, add to `DESIRED_JOBS` array:

```typescript
  { name: 'group-enrollment-expiry',     pattern: '*/30 * * * *' },
  { name: 'group-session-cancellation',  pattern: '0 * * * *'    },
  { name: 'group-session-reminder',      pattern: '0 * * * *'    },
```

- [ ] **Step 3: Add cases to tasks.processor.ts**

In `backend/src/modules/tasks/tasks.processor.ts`:

Add import:
```typescript
import { GroupSessionAutomationService } from './group-session-automation.service.js';
```

Add to constructor:
```typescript
private readonly groupSessionAutomation: GroupSessionAutomationService,
```

Add cases in the switch:
```typescript
      case 'group-enrollment-expiry':
        await this.groupSessionAutomation.expireUnpaidEnrollments();
        break;
      case 'group-session-cancellation':
        await this.groupSessionAutomation.cancelIncompleteSessiones();
        break;
      case 'group-session-reminder':
        await this.groupSessionAutomation.sendSessionReminders();
        break;
```

- [ ] **Step 4: Register GroupSessionAutomationService in tasks.module.ts**

Add the service as a provider and import the NotificationsModule if not already imported.

- [ ] **Step 5: Verify TypeScript compiles**

Run: `cd backend && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add backend/src/modules/tasks/
git commit -m "feat(group-sessions): add cron jobs — enrollment expiry, session cancellation, reminders"
```

---

## Phase 4: Dashboard — Types, API, Hooks

### Task 10: Dashboard Types & API Layer

**Files:**
- Create: `dashboard/lib/types/group-sessions.ts`
- Create: `dashboard/lib/api/group-sessions.ts`
- Create: `dashboard/lib/schemas/group-sessions.schema.ts`
- Modify: `dashboard/lib/query-keys.ts`

- [ ] **Step 1: Create types**

Create `dashboard/lib/types/group-sessions.ts`:

```typescript
export type GroupSessionStatus = 'open' | 'confirmed' | 'full' | 'completed' | 'cancelled'
export type GroupEnrollmentStatus = 'registered' | 'confirmed' | 'attended' | 'expired' | 'cancelled'

export interface GroupOffering {
  id: string
  nameAr: string
  nameEn: string
  descriptionAr: string | null
  descriptionEn: string | null
  employeeId: string
  departmentId: string | null
  minParticipants: number
  maxParticipants: number
  pricePerPersonHalalat: number
  durationMin: number
  paymentDeadlineHours: number
  createdAt: string
  updatedAt: string
  employee?: { id: string; nameAr: string; nameEn: string }
  _count?: { sessions: number }
}

export interface GroupSession {
  id: string
  groupOfferingId: string
  startTime: string
  endTime: string
  status: GroupSessionStatus
  currentEnrollment: number
  registrationDeadline: string
  reminderSent: boolean
  createdAt: string
  updatedAt: string
  groupOffering?: {
    nameAr: string
    nameEn: string
    minParticipants: number
    maxParticipants: number
    pricePerPersonHalalat: number
    durationMin: number
    paymentDeadlineHours: number
    employee?: { id: string; nameAr: string; nameEn: string }
  }
  enrollments?: GroupEnrollment[]
}

export interface GroupEnrollment {
  id: string
  groupSessionId: string
  clientId: string
  paymentId: string | null
  status: GroupEnrollmentStatus
  paymentDeadlineAt: string | null
  expiredAt: string | null
  createdAt: string
  updatedAt: string
  client?: { id: string; nameAr: string; nameEn: string; phone: string }
  payment?: { id: string; status: string } | null
}

export interface OfferingListQuery {
  page?: number
  perPage?: number
  search?: string
  employeeId?: string
}

export interface SessionListQuery {
  page?: number
  perPage?: number
  groupOfferingId?: string
  status?: GroupSessionStatus
}

export interface CreateOfferingPayload {
  nameAr: string
  nameEn: string
  descriptionAr?: string
  descriptionEn?: string
  employeeId: string
  departmentId?: string
  minParticipants: number
  maxParticipants: number
  pricePerPersonHalalat: number
  durationMin: number
  paymentDeadlineHours?: number
}

export interface UpdateOfferingPayload extends Partial<CreateOfferingPayload> {}

export interface CreateSessionPayload {
  startTime: string
  registrationDeadline: string
}

export interface MarkAttendancePayload {
  attendedClientIds: string[]
}
```

- [ ] **Step 2: Create API functions**

Create `dashboard/lib/api/group-sessions.ts`:

```typescript
import { api } from "@/lib/api"
import type {
  GroupOffering,
  GroupSession,
  GroupEnrollment,
  OfferingListQuery,
  SessionListQuery,
  CreateOfferingPayload,
  UpdateOfferingPayload,
  CreateSessionPayload,
  MarkAttendancePayload,
} from "@/lib/types/group-sessions"
import type { PaginatedResponse } from "@/lib/types/common"

// ─── Offerings ───

export async function fetchOfferings(
  query: OfferingListQuery = {},
): Promise<PaginatedResponse<GroupOffering>> {
  return api.get("/group-sessions/offerings", query as Record<string, string | number | boolean | undefined>)
}

export async function fetchOffering(id: string): Promise<GroupOffering> {
  return api.get(`/group-sessions/offerings/${id}`)
}

export async function createOffering(payload: CreateOfferingPayload): Promise<GroupOffering> {
  return api.post("/group-sessions/offerings", payload)
}

export async function updateOffering(id: string, payload: UpdateOfferingPayload): Promise<GroupOffering> {
  return api.patch(`/group-sessions/offerings/${id}`, payload)
}

export async function deleteOffering(id: string): Promise<void> {
  return api.delete(`/group-sessions/offerings/${id}`)
}

// ─── Sessions ───

export async function fetchSessions(
  query: SessionListQuery = {},
): Promise<PaginatedResponse<GroupSession>> {
  return api.get("/group-sessions/sessions", query as Record<string, string | number | boolean | undefined>)
}

export async function fetchSession(id: string): Promise<GroupSession> {
  return api.get(`/group-sessions/sessions/${id}`)
}

export async function createSession(offeringId: string, payload: CreateSessionPayload): Promise<GroupSession> {
  return api.post(`/group-sessions/offerings/${offeringId}/sessions`, payload)
}

export async function cancelSession(id: string): Promise<void> {
  return api.patch(`/group-sessions/sessions/${id}/cancel`, {})
}

export async function completeSession(id: string, payload: MarkAttendancePayload): Promise<void> {
  return api.post(`/group-sessions/sessions/${id}/attendance`, payload)
}

// ─── Enrollments ───

export async function enrollClient(sessionId: string, clientId: string): Promise<GroupEnrollment> {
  return api.post(`/group-sessions/sessions/${sessionId}/enroll`, { clientId })
}

export async function cancelEnrollment(sessionId: string, enrollmentId: string, clientId: string): Promise<void> {
  return api.patch(`/group-sessions/sessions/${sessionId}/enrollments/${enrollmentId}/cancel`, { clientId })
}

export async function removeEnrollment(sessionId: string, enrollmentId: string): Promise<void> {
  return api.delete(`/group-sessions/sessions/${sessionId}/enrollments/${enrollmentId}`)
}
```

- [ ] **Step 3: Create Zod schemas**

Create `dashboard/lib/schemas/group-sessions.schema.ts`:

```typescript
import { z } from "zod"

export const createOfferingSchema = z.object({
  nameAr: z.string().min(1).max(255),
  nameEn: z.string().min(1).max(255),
  descriptionAr: z.string().max(2000).optional(),
  descriptionEn: z.string().max(2000).optional(),
  employeeId: z.string().uuid(),
  departmentId: z.string().uuid().optional(),
  minParticipants: z.number().int().min(1),
  maxParticipants: z.number().int().min(1),
  pricePerPersonHalalat: z.number().int().min(0),
  durationMin: z.number().int().min(1),
  paymentDeadlineHours: z.number().int().min(1).max(168).optional(),
}).refine(
  (data) => data.minParticipants <= data.maxParticipants,
  { message: "الحد الأدنى لا يمكن أن يتجاوز الحد الأقصى", path: ["minParticipants"] },
)

export const createSessionSchema = z.object({
  startTime: z.string().datetime(),
  registrationDeadline: z.string().datetime(),
}).refine(
  (data) => new Date(data.registrationDeadline) < new Date(data.startTime),
  { message: "آخر موعد للتسجيل يجب أن يكون قبل وقت الجلسة", path: ["registrationDeadline"] },
)

export type CreateOfferingFormValues = z.infer<typeof createOfferingSchema>
export type CreateSessionFormValues = z.infer<typeof createSessionSchema>
```

- [ ] **Step 4: Add query keys**

In `dashboard/lib/query-keys.ts`, add after the `departments` section:

```typescript
  /* ─── Group Sessions ─── */
  groupSessions: {
    all: ["group-sessions"] as const,
    offerings: {
      all: ["group-sessions", "offerings"] as const,
      list: (filters?: object) => ["group-sessions", "offerings", "list", filters] as const,
      detail: (id: string) => ["group-sessions", "offerings", "detail", id] as const,
    },
    sessions: {
      all: ["group-sessions", "sessions"] as const,
      list: (filters?: object) => ["group-sessions", "sessions", "list", filters] as const,
      detail: (id: string) => ["group-sessions", "sessions", "detail", id] as const,
    },
  },
```

- [ ] **Step 5: Commit**

```bash
git add dashboard/lib/types/group-sessions.ts dashboard/lib/api/group-sessions.ts dashboard/lib/schemas/group-sessions.schema.ts dashboard/lib/query-keys.ts
git commit -m "feat(group-sessions): add dashboard types, API layer, Zod schemas, query keys"
```

---

### Task 11: Dashboard Hooks

**Files:**
- Create: `dashboard/hooks/use-group-sessions.ts`
- Create: `dashboard/hooks/use-group-sessions-mutations.ts`

- [ ] **Step 1: Create query hooks**

Create `dashboard/hooks/use-group-sessions.ts`:

```typescript
"use client"

import { useState, useCallback } from "react"
import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { fetchOfferings, fetchSessions, fetchSession } from "@/lib/api/group-sessions"
import type { OfferingListQuery, SessionListQuery, GroupSessionStatus } from "@/lib/types/group-sessions"

export function useGroupOfferings() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const [employeeId, setEmployeeId] = useState<string | undefined>()

  const query: OfferingListQuery = {
    page,
    perPage: 20,
    search: search || undefined,
    employeeId,
  }

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.groupSessions.offerings.list(query),
    queryFn: () => fetchOfferings(query),
    staleTime: 5 * 60 * 1000,
  })

  const resetFilters = useCallback(() => {
    setSearch("")
    setEmployeeId(undefined)
    setPage(1)
  }, [])

  return {
    offerings: data?.items ?? [],
    meta: data?.meta ?? null,
    isLoading,
    error: error instanceof Error ? error.message : null,
    page,
    setPage,
    search,
    setSearch: (s: string) => { setSearch(s); setPage(1) },
    employeeId,
    setEmployeeId: (v: string | undefined) => { setEmployeeId(v); setPage(1) },
    resetFilters,
    refetch,
  }
}

export function useGroupSessions() {
  const [page, setPage] = useState(1)
  const [groupOfferingId, setGroupOfferingId] = useState<string | undefined>()
  const [status, setStatus] = useState<GroupSessionStatus | undefined>()

  const query: SessionListQuery = {
    page,
    perPage: 20,
    groupOfferingId,
    status,
  }

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.groupSessions.sessions.list(query),
    queryFn: () => fetchSessions(query),
    staleTime: 5 * 60 * 1000,
  })

  const resetFilters = useCallback(() => {
    setGroupOfferingId(undefined)
    setStatus(undefined)
    setPage(1)
  }, [])

  return {
    sessions: data?.items ?? [],
    meta: data?.meta ?? null,
    isLoading,
    error: error instanceof Error ? error.message : null,
    page,
    setPage,
    groupOfferingId,
    setGroupOfferingId: (v: string | undefined) => { setGroupOfferingId(v); setPage(1) },
    status,
    setStatus: (v: GroupSessionStatus | undefined) => { setStatus(v); setPage(1) },
    resetFilters,
    refetch,
  }
}

export function useGroupSessionDetail(id: string) {
  return useQuery({
    queryKey: queryKeys.groupSessions.sessions.detail(id),
    queryFn: () => fetchSession(id),
    staleTime: 2 * 60 * 1000,
    enabled: !!id,
  })
}
```

- [ ] **Step 2: Create mutation hooks**

Create `dashboard/hooks/use-group-sessions-mutations.ts`:

```typescript
"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import {
  createOffering,
  updateOffering,
  deleteOffering,
  createSession,
  cancelSession,
  completeSession,
  enrollClient,
  removeEnrollment,
} from "@/lib/api/group-sessions"
import type { UpdateOfferingPayload, CreateSessionPayload, MarkAttendancePayload } from "@/lib/types/group-sessions"

export function useGroupSessionsMutations() {
  const queryClient = useQueryClient()

  const invalidateAll = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.groupSessions.all })

  const createOfferingMut = useMutation({
    mutationFn: createOffering,
    onSuccess: invalidateAll,
  })

  const updateOfferingMut = useMutation({
    mutationFn: ({ id, ...payload }: { id: string } & UpdateOfferingPayload) =>
      updateOffering(id, payload),
    onSuccess: invalidateAll,
  })

  const deleteOfferingMut = useMutation({
    mutationFn: deleteOffering,
    onSuccess: invalidateAll,
  })

  const createSessionMut = useMutation({
    mutationFn: ({ offeringId, ...payload }: { offeringId: string } & CreateSessionPayload) =>
      createSession(offeringId, payload),
    onSuccess: invalidateAll,
  })

  const cancelSessionMut = useMutation({
    mutationFn: cancelSession,
    onSuccess: invalidateAll,
  })

  const completeSessionMut = useMutation({
    mutationFn: ({ id, ...payload }: { id: string } & MarkAttendancePayload) =>
      completeSession(id, payload),
    onSuccess: invalidateAll,
  })

  const enrollClientMut = useMutation({
    mutationFn: ({ sessionId, clientId }: { sessionId: string; clientId: string }) =>
      enrollClient(sessionId, clientId),
    onSuccess: invalidateAll,
  })

  const removeEnrollmentMut = useMutation({
    mutationFn: ({ sessionId, enrollmentId }: { sessionId: string; enrollmentId: string }) =>
      removeEnrollment(sessionId, enrollmentId),
    onSuccess: invalidateAll,
  })

  return {
    createOfferingMut,
    updateOfferingMut,
    deleteOfferingMut,
    createSessionMut,
    cancelSessionMut,
    completeSessionMut,
    enrollClientMut,
    removeEnrollmentMut,
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add dashboard/hooks/use-group-sessions.ts dashboard/hooks/use-group-sessions-mutations.ts
git commit -m "feat(group-sessions): add dashboard hooks — queries and mutations"
```

---

## Phase 5: Dashboard — Pages & Components

### Task 12: Sidebar Integration

**Files:**
- Modify: `dashboard/components/sidebar-config.ts`

- [ ] **Step 1: Add featureFlag field to NavItem interface**

In `dashboard/components/sidebar-config.ts`, update `NavItem`:

```typescript
export interface NavItem {
  titleKey: string
  href: string
  icon: typeof Home01Icon
  badge?: number
  permission?: string
  featureFlag?: string
}
```

- [ ] **Step 2: Add Group Sessions nav item to clinicNav**

Add import and nav item:

```typescript
// Add to imports:
import { UserGroupIcon } from "@hugeicons/core-free-icons"

// Add to clinicNav array (after intakeForms):
{ titleKey: "nav.groupSessions", href: "/group-sessions", icon: UserGroupIcon, featureFlag: "group_sessions" },
```

Note: Check the exact icon name available in `@hugeicons/core-free-icons`. Use `UserGroupIcon` or similar group-related icon.

- [ ] **Step 3: Commit**

```bash
git add dashboard/components/sidebar-config.ts
git commit -m "feat(group-sessions): add sidebar nav item with featureFlag support"
```

---

### Task 13: Main Page

**Files:**
- Create: `dashboard/app/(dashboard)/group-sessions/page.tsx`

- [ ] **Step 1: Create the page**

Create `dashboard/app/(dashboard)/group-sessions/page.tsx`:

```tsx
"use client"

import { useState } from "react"
import { Breadcrumbs } from "@/components/features/shared/breadcrumbs"
import { PageHeader } from "@/components/features/shared/page-header"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { OfferingsTabContent } from "@/components/features/group-sessions/offerings-tab-content"
import { SessionsTabContent } from "@/components/features/group-sessions/sessions-tab-content"
import { CreateOfferingDialog } from "@/components/features/group-sessions/create-offering-dialog"

export default function GroupSessionsPage() {
  const [activeTab, setActiveTab] = useState("offerings")
  const [createOpen, setCreateOpen] = useState(false)

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "الجلسات الجماعية" }]} />

      <PageHeader
        title="الجلسات الجماعية"
        description="إدارة العروض والجلسات الجماعية"
        primaryAction={{ label: "إنشاء عرض", onClick: () => setCreateOpen(true) }}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="offerings">العروض</TabsTrigger>
          <TabsTrigger value="sessions">الجلسات</TabsTrigger>
        </TabsList>

        <TabsContent value="offerings">
          <OfferingsTabContent />
        </TabsContent>

        <TabsContent value="sessions">
          <SessionsTabContent />
        </TabsContent>
      </Tabs>

      <CreateOfferingDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  )
}
```

Note: This page is ~40 lines — well within the 120-line page limit. Adjust imports based on your actual shared component names (check `components/features/shared/` for exact names of `Breadcrumbs`, `PageHeader`, etc.).

- [ ] **Step 2: Commit**

```bash
git add dashboard/app/\(dashboard\)/group-sessions/
git commit -m "feat(group-sessions): add main dashboard page with tabs"
```

---

### Task 14: Offerings Tab & Create Dialog

**Files:**
- Create: `dashboard/components/features/group-sessions/offerings-tab-content.tsx`
- Create: `dashboard/components/features/group-sessions/offering-card.tsx`
- Create: `dashboard/components/features/group-sessions/create-offering-dialog.tsx`

- [ ] **Step 1: Create offerings-tab-content.tsx**

This component renders a grid of offering cards. Build it following the pattern of other tab content components in the project. It should use `useGroupOfferings()` hook and render `offering-card` for each item.

- [ ] **Step 2: Create offering-card.tsx**

A card showing: name, employee, min/max participants, price, upcoming sessions count, and action buttons (edit, schedule session, disable).

- [ ] **Step 3: Create create-offering-dialog.tsx**

A dialog form using `react-hook-form` + `zodResolver` with `createOfferingSchema`. Fields: nameAr, nameEn, descriptionAr/En, employee select, min/max participants, price (with halalat conversion), duration, payment deadline hours.

Follow the existing dialog patterns in `dashboard/components/features/` — check a similar dialog like `create-department-dialog.tsx` for the exact structure.

- [ ] **Step 4: Verify TypeScript**

Run: `cd dashboard && npm run typecheck`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add dashboard/components/features/group-sessions/
git commit -m "feat(group-sessions): add offerings tab — card grid, create dialog"
```

---

### Task 15: Sessions Tab & Schedule Dialog

**Files:**
- Create: `dashboard/components/features/group-sessions/sessions-tab-content.tsx`
- Create: `dashboard/components/features/group-sessions/schedule-session-dialog.tsx`
- Create: `dashboard/components/features/group-sessions/cancel-session-dialog.tsx`

- [ ] **Step 1: Create sessions-tab-content.tsx**

A DataTable with columns: offering name, date/time, enrolled/max, status badge, actions. Include FilterBar with status filter and offering filter. Follow the page anatomy law from CLAUDE.md — FilterBar, then bare DataTable, then Pagination.

- [ ] **Step 2: Create schedule-session-dialog.tsx**

Dialog to schedule a new session from an offering. Fields: start date/time picker, registration deadline date/time picker. Uses `createSessionSchema` for validation.

- [ ] **Step 3: Create cancel-session-dialog.tsx**

Confirmation dialog. Shows session name and date, warns that all enrollments will be cancelled, asks for confirmation.

- [ ] **Step 4: Verify TypeScript**

Run: `cd dashboard && npm run typecheck`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add dashboard/components/features/group-sessions/
git commit -m "feat(group-sessions): add sessions tab — DataTable, schedule dialog, cancel dialog"
```

---

### Task 16: Session Detail Page

**Files:**
- Create: `dashboard/app/(dashboard)/group-sessions/[sessionId]/page.tsx`
- Create: `dashboard/components/features/group-sessions/session-detail-header.tsx`
- Create: `dashboard/components/features/group-sessions/enrollments-table.tsx`
- Create: `dashboard/components/features/group-sessions/attendance-form.tsx`
- Create: `dashboard/components/features/group-sessions/enroll-client-dialog.tsx`

- [ ] **Step 1: Create the detail page**

Create `dashboard/app/(dashboard)/group-sessions/[sessionId]/page.tsx`:

```tsx
"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import { Breadcrumbs } from "@/components/features/shared/breadcrumbs"
import { useGroupSessionDetail } from "@/hooks/use-group-sessions"
import { SessionDetailHeader } from "@/components/features/group-sessions/session-detail-header"
import { EnrollmentsTable } from "@/components/features/group-sessions/enrollments-table"
import { AttendanceForm } from "@/components/features/group-sessions/attendance-form"
import { EnrollClientDialog } from "@/components/features/group-sessions/enroll-client-dialog"
import { Skeleton } from "@/components/ui/skeleton"

export default function SessionDetailPage() {
  const params = useParams<{ sessionId: string }>()
  const { data: session, isLoading } = useGroupSessionDetail(params.sessionId)
  const [enrollOpen, setEnrollOpen] = useState(false)

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-[200px]" />
        <Skeleton className="h-[300px]" />
      </div>
    )
  }

  if (!session) return null

  const offeringName = session.groupOffering?.nameAr ?? ""

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: "الجلسات الجماعية", href: "/group-sessions" },
          { label: offeringName },
        ]}
      />

      <SessionDetailHeader
        session={session}
        onEnrollClick={() => setEnrollOpen(true)}
      />

      <EnrollmentsTable enrollments={session.enrollments ?? []} sessionId={session.id} />

      {(session.status === "confirmed" || session.status === "full") && (
        <AttendanceForm session={session} />
      )}

      <EnrollClientDialog
        open={enrollOpen}
        onOpenChange={setEnrollOpen}
        sessionId={session.id}
      />
    </div>
  )
}
```

- [ ] **Step 2: Create session-detail-header.tsx**

Shows: offering name, employee, date/time, duration, status badge, enrollment indicator ("3 enrolled, 2 paid, 1 awaiting"), and action buttons (Add Client, Cancel Session, Complete Session).

- [ ] **Step 3: Create enrollments-table.tsx**

DataTable with columns: client name, enrollment status (with colored badges), payment status, payment deadline, actions (remove — only for pre-payment enrollments).

- [ ] **Step 4: Create attendance-form.tsx**

Checkboxes for each confirmed enrollment. "Save Attendance & Complete Session" button calls `completeSessionMut`.

- [ ] **Step 5: Create enroll-client-dialog.tsx**

Dialog with a client search/select field. Uses `enrollClientMut`.

- [ ] **Step 6: Verify TypeScript**

Run: `cd dashboard && npm run typecheck`
Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add dashboard/app/\(dashboard\)/group-sessions/ dashboard/components/features/group-sessions/
git commit -m "feat(group-sessions): add session detail page — header, enrollments table, attendance form"
```

---

## Phase 6: Feature Flag Seed & Final Integration

### Task 17: Seed Feature Flag

**Files:**
- Modify: `backend/prisma/seed.ts` (or wherever seed data lives)

- [ ] **Step 1: Find the seed file**

Run: `cd backend && grep -rl "featureFlag" prisma/ src/ --include="*.ts" | head -5`

- [ ] **Step 2: Add group_sessions feature flag to seed**

Add to the feature flags seed section:

```typescript
{
  key: 'group_sessions',
  enabled: false,
  nameAr: 'الجلسات الجماعية',
  nameEn: 'Group Sessions',
  descriptionAr: 'جلسات علاجية جماعية بنظام الطلب المسبق',
  descriptionEn: 'Pre-order group therapy sessions',
}
```

- [ ] **Step 3: Commit**

```bash
git add backend/prisma/
git commit -m "feat(group-sessions): seed group_sessions feature flag (disabled by default)"
```

---

### Task 18: Add Feature to ESLint Config

**Files:**
- Modify: `dashboard/eslint.config.mjs`

Per the dashboard CLAUDE.md pre-PR checklist: new features must be added to the ESLint FEATURES list.

- [ ] **Step 1: Find and update FEATURES**

Run: `cd dashboard && grep -n "FEATURES" eslint.config.mjs`

Add `"group-sessions"` to the FEATURES array.

- [ ] **Step 2: Commit**

```bash
git add dashboard/eslint.config.mjs
git commit -m "chore(group-sessions): add to ESLint FEATURES list"
```

---

### Task 19: Final Validation

- [ ] **Step 1: Backend TypeScript check**

Run: `cd backend && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 2: Backend tests**

Run: `cd backend && npx jest test/unit/group-sessions/ --no-coverage`
Expected: All tests pass.

- [ ] **Step 3: Dashboard TypeScript check**

Run: `cd dashboard && npm run typecheck`
Expected: No errors.

- [ ] **Step 4: Dashboard lint**

Run: `cd dashboard && npm run lint`
Expected: No errors.

- [ ] **Step 5: Verify file sizes**

No file should exceed 350 lines (backend service files, DTOs, controller, components). Check any files that felt large during implementation.

- [ ] **Step 6: Final commit if any fixes needed**

```bash
git commit -m "fix(group-sessions): address validation issues"
```

---

## Summary

| Phase | Tasks | New Files | Modified Files | Commits |
|-------|-------|-----------|---------------|---------|
| 1. Database Schema | 1-3 | 1 | ~5 | 2 |
| 2. Backend Module | 4-8 | ~10 | 1 | 5 |
| 3. Cron Jobs | 9 | 1 | 3 | 1 |
| 4. Dashboard Lib | 10-11 | 5 | 1 | 2 |
| 5. Dashboard UI | 12-16 | ~13 | 1 | 5 |
| 6. Integration | 17-19 | 0 | 2 | 2 |
| **Total** | **19 tasks** | **~30** | **~13** | **~17** |
