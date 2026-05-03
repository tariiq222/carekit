# Employee Breaks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement `GET /employees/:id/breaks` and `PUT /employees/:id/breaks` with a real `EmployeeBreak` DB table, replacing the current no-op stubs, and wire the frontend i18n gaps.

**Architecture:** New `EmployeeBreak` Prisma model in `people.prisma` + Prisma migration. Two vertical-slice handlers (`get-employee-breaks`, `set-employee-breaks`) registered in `PeopleModule`. Controller stubs replaced with real handler calls. Frontend `BreaksSection` hardcoded strings replaced with `t()` calls and 3 missing i18n keys added.

**Tech Stack:** NestJS 11, Prisma 7, Jest, Next.js 15, TanStack Query

---

## File Map

| File | Action |
|------|--------|
| `apps/backend/prisma/schema/people.prisma` | Add `EmployeeBreak` model + `Employee.breaks` relation |
| `apps/backend/prisma/migrations/20260503080000_add_employee_break/migration.sql` | New migration |
| `apps/backend/src/modules/people/employees/get-employee-breaks/get-employee-breaks.handler.ts` | New handler |
| `apps/backend/src/modules/people/employees/get-employee-breaks/get-employee-breaks.handler.spec.ts` | New tests |
| `apps/backend/src/modules/people/employees/set-employee-breaks/set-employee-breaks.dto.ts` | New DTO |
| `apps/backend/src/modules/people/employees/set-employee-breaks/set-employee-breaks.handler.ts` | New handler |
| `apps/backend/src/modules/people/employees/set-employee-breaks/set-employee-breaks.handler.spec.ts` | New tests |
| `apps/backend/src/modules/people/people.module.ts` | Register 2 new handlers |
| `apps/backend/src/api/dashboard/people.controller.ts` | Wire endpoints, remove stubs |
| `apps/backend/openapi.json` | Snapshot update (run command) |
| `apps/dashboard/lib/translations/en.employees.ts` | Add 3 i18n keys |
| `apps/dashboard/lib/translations/ar.employees.ts` | Add 3 i18n keys |
| `apps/dashboard/components/features/employees/breaks-section.tsx` | Replace hardcoded strings with `t()` |

---

### Task 1: Add `EmployeeBreak` to Prisma schema

**Files:**
- Modify: `apps/backend/prisma/schema/people.prisma`

- [ ] **Step 1: Add the model and relation**

In `apps/backend/prisma/schema/people.prisma`, add the `EmployeeBreak` model after `EmployeeAvailabilityException`:

```prisma
model EmployeeBreak {
  id             String   @id @default(uuid())
  organizationId String
  employeeId     String
  employee       Employee @relation(fields: [employeeId], references: [id], onDelete: Cascade)
  dayOfWeek      Int
  startTime      String
  endTime        String
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  @@index([employeeId, dayOfWeek])
  @@index([organizationId])
}
```

Also add `breaks EmployeeBreak[]` to the `Employee` model's relations block (after the existing `exceptions` relation line):

```prisma
  breaks       EmployeeBreak[]
```

- [ ] **Step 2: Generate and apply migration**

```bash
cd apps/backend && npm run prisma:migrate -- --name add_employee_break
```

Expected: new folder `prisma/migrations/20260503080000_add_employee_break/` with `migration.sql` containing `CREATE TABLE "EmployeeBreak"`. Prisma client regenerated.

- [ ] **Step 3: Verify Prisma client has the new model**

```bash
cd apps/backend && npx tsc --noEmit 2>&1 | grep -i "employeebreak" | head -5
```

Expected: no output (no type errors for the new model).

- [ ] **Step 4: Commit**

```bash
git add apps/backend/prisma/schema/people.prisma apps/backend/prisma/migrations/
git commit -m "feat(people): add EmployeeBreak schema + migration"
```

---

### Task 2: `get-employee-breaks` handler + tests (TDD)

**Files:**
- Create: `apps/backend/src/modules/people/employees/get-employee-breaks/get-employee-breaks.handler.spec.ts`
- Create: `apps/backend/src/modules/people/employees/get-employee-breaks/get-employee-breaks.handler.ts`

- [ ] **Step 1: Write the failing tests**

Create `apps/backend/src/modules/people/employees/get-employee-breaks/get-employee-breaks.handler.spec.ts`:

```typescript
import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { GetEmployeeBreaksHandler } from './get-employee-breaks.handler';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';

describe('GetEmployeeBreaksHandler', () => {
  let handler: GetEmployeeBreaksHandler;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      employee: { findFirst: jest.fn() },
      employeeBreak: { findMany: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetEmployeeBreaksHandler,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    handler = module.get(GetEmployeeBreaksHandler);
  });

  it('throws NotFoundException when employee does not exist', async () => {
    prisma.employee.findFirst.mockResolvedValue(null);
    await expect(handler.execute({ employeeId: 'emp-1' })).rejects.toThrow(NotFoundException);
  });

  it('returns empty breaks array when no breaks configured', async () => {
    prisma.employee.findFirst.mockResolvedValue({ id: 'emp-1', organizationId: 'org-1' });
    prisma.employeeBreak.findMany.mockResolvedValue([]);

    const result = await handler.execute({ employeeId: 'emp-1' });

    expect(result).toEqual({ breaks: [] });
  });

  it('returns breaks ordered by dayOfWeek then startTime', async () => {
    prisma.employee.findFirst.mockResolvedValue({ id: 'emp-1', organizationId: 'org-1' });
    const breaks = [
      { id: 'b1', dayOfWeek: 1, startTime: '10:00', endTime: '10:30' },
      { id: 'b2', dayOfWeek: 1, startTime: '15:00', endTime: '15:15' },
      { id: 'b3', dayOfWeek: 3, startTime: '12:00', endTime: '13:00' },
    ];
    prisma.employeeBreak.findMany.mockResolvedValue(breaks);

    const result = await handler.execute({ employeeId: 'emp-1' });

    expect(result).toEqual({ breaks });
    expect(prisma.employeeBreak.findMany).toHaveBeenCalledWith({
      where: { employeeId: 'emp-1' },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd apps/backend && npx jest get-employee-breaks.handler.spec.ts --no-coverage
```

Expected: FAIL — `Cannot find module './get-employee-breaks.handler'`

- [ ] **Step 3: Implement the handler**

Create `apps/backend/src/modules/people/employees/get-employee-breaks/get-employee-breaks.handler.ts`:

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';

export type GetEmployeeBreaksCommand = { employeeId: string };

@Injectable()
export class GetEmployeeBreaksHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(cmd: GetEmployeeBreaksCommand) {
    const employee = await this.prisma.employee.findFirst({
      where: { id: cmd.employeeId },
    });
    if (!employee) throw new NotFoundException('Employee not found');

    const breaks = await this.prisma.employeeBreak.findMany({
      where: { employeeId: cmd.employeeId },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });

    return { breaks };
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd apps/backend && npx jest get-employee-breaks.handler.spec.ts --no-coverage
```

Expected: PASS — 3 tests passing.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/modules/people/employees/get-employee-breaks/
git commit -m "feat(people): get-employee-breaks handler + tests"
```

---

### Task 3: `set-employee-breaks` DTO + handler + tests (TDD)

**Files:**
- Create: `apps/backend/src/modules/people/employees/set-employee-breaks/set-employee-breaks.dto.ts`
- Create: `apps/backend/src/modules/people/employees/set-employee-breaks/set-employee-breaks.handler.spec.ts`
- Create: `apps/backend/src/modules/people/employees/set-employee-breaks/set-employee-breaks.handler.ts`

- [ ] **Step 1: Create the DTO**

Create `apps/backend/src/modules/people/employees/set-employee-breaks/set-employee-breaks.dto.ts`:

```typescript
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsInt, IsString, Matches, Max, Min, ValidateNested } from 'class-validator';

export class BreakWindowDto {
  @ApiProperty({ description: 'Day of week (0 = Sunday, 6 = Saturday)', example: 1 })
  @IsInt() @Min(0) @Max(6) dayOfWeek!: number;

  @ApiProperty({ description: 'Break start time (HH:MM)', example: '12:00' })
  @IsString() @Matches(/^\d{2}:\d{2}$/) startTime!: string;

  @ApiProperty({ description: 'Break end time (HH:MM)', example: '13:00' })
  @IsString() @Matches(/^\d{2}:\d{2}$/) endTime!: string;
}

export class SetEmployeeBreaksDto {
  @ApiProperty({ description: 'Break windows to set', type: [BreakWindowDto] })
  @IsArray() @ValidateNested({ each: true }) @Type(() => BreakWindowDto)
  breaks!: BreakWindowDto[];
}
```

- [ ] **Step 2: Write the failing tests**

Create `apps/backend/src/modules/people/employees/set-employee-breaks/set-employee-breaks.handler.spec.ts`:

```typescript
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { SetEmployeeBreaksHandler } from './set-employee-breaks.handler';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';

const EMPLOYEE = { id: 'emp-1', organizationId: 'org-1' };

const SHIFT_MON = { employeeId: 'emp-1', dayOfWeek: 1, startTime: '09:00', endTime: '17:00', isActive: true };

const makeCmd = (overrides = {}) => ({
  employeeId: 'emp-1',
  breaks: [{ dayOfWeek: 1, startTime: '12:00', endTime: '13:00' }],
  ...overrides,
});

describe('SetEmployeeBreaksHandler', () => {
  let handler: SetEmployeeBreaksHandler;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      employee: { findFirst: jest.fn() },
      employeeAvailability: { findMany: jest.fn() },
      employeeBreak: { deleteMany: jest.fn(), createMany: jest.fn(), findMany: jest.fn() },
      $transaction: jest.fn().mockImplementation((fn: (tx: unknown) => unknown) => fn(prisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SetEmployeeBreaksHandler,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    handler = module.get(SetEmployeeBreaksHandler);
  });

  it('throws NotFoundException when employee does not exist', async () => {
    prisma.employee.findFirst.mockResolvedValue(null);
    await expect(handler.execute(makeCmd())).rejects.toThrow(NotFoundException);
  });

  it('throws BadRequestException when startTime >= endTime', async () => {
    prisma.employee.findFirst.mockResolvedValue(EMPLOYEE);
    await expect(
      handler.execute(makeCmd({ breaks: [{ dayOfWeek: 1, startTime: '13:00', endTime: '12:00' }] })),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException when no shift exists for the break day', async () => {
    prisma.employee.findFirst.mockResolvedValue(EMPLOYEE);
    prisma.employeeAvailability.findMany.mockResolvedValue([]); // no shifts
    await expect(handler.execute(makeCmd())).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException when break falls outside every shift for that day', async () => {
    prisma.employee.findFirst.mockResolvedValue(EMPLOYEE);
    // Shift is 09:00-12:00, break is 12:00-13:00 (endTime exceeds shift)
    prisma.employeeAvailability.findMany.mockResolvedValue([
      { ...SHIFT_MON, startTime: '09:00', endTime: '12:00' },
    ]);
    await expect(
      handler.execute(makeCmd({ breaks: [{ dayOfWeek: 1, startTime: '11:30', endTime: '13:00' }] })),
    ).rejects.toThrow(BadRequestException);
  });

  it('replaces all breaks and returns newly created rows', async () => {
    prisma.employee.findFirst.mockResolvedValue(EMPLOYEE);
    prisma.employeeAvailability.findMany.mockResolvedValue([SHIFT_MON]);
    prisma.employeeBreak.deleteMany.mockResolvedValue({ count: 2 });
    prisma.employeeBreak.createMany.mockResolvedValue({ count: 1 });
    const created = [{ id: 'br-1', dayOfWeek: 1, startTime: '12:00', endTime: '13:00', organizationId: 'org-1', employeeId: 'emp-1' }];
    prisma.employeeBreak.findMany.mockResolvedValue(created);

    const result = await handler.execute(makeCmd());

    expect(prisma.employeeBreak.deleteMany).toHaveBeenCalledWith({ where: { employeeId: 'emp-1' } });
    expect(prisma.employeeBreak.createMany).toHaveBeenCalledWith({
      data: [{ employeeId: 'emp-1', organizationId: 'org-1', dayOfWeek: 1, startTime: '12:00', endTime: '13:00' }],
    });
    expect(result).toEqual({ breaks: created });
  });

  it('accepts a break that fits inside a split shift', async () => {
    prisma.employee.findFirst.mockResolvedValue(EMPLOYEE);
    // Two shifts on Monday: 09:00-12:00 and 14:00-18:00
    prisma.employeeAvailability.findMany.mockResolvedValue([
      { ...SHIFT_MON, startTime: '09:00', endTime: '12:00' },
      { ...SHIFT_MON, startTime: '14:00', endTime: '18:00' },
    ]);
    prisma.employeeBreak.deleteMany.mockResolvedValue({ count: 0 });
    prisma.employeeBreak.createMany.mockResolvedValue({ count: 1 });
    const created = [{ id: 'br-2', dayOfWeek: 1, startTime: '10:00', endTime: '10:30' }];
    prisma.employeeBreak.findMany.mockResolvedValue(created);

    const result = await handler.execute(
      makeCmd({ breaks: [{ dayOfWeek: 1, startTime: '10:00', endTime: '10:30' }] }),
    );

    expect(result).toEqual({ breaks: created });
  });

  it('clears all breaks when empty array is provided', async () => {
    prisma.employee.findFirst.mockResolvedValue(EMPLOYEE);
    prisma.employeeBreak.deleteMany.mockResolvedValue({ count: 3 });
    prisma.employeeBreak.createMany.mockResolvedValue({ count: 0 });
    prisma.employeeBreak.findMany.mockResolvedValue([]);

    const result = await handler.execute(makeCmd({ breaks: [] }));

    expect(prisma.employeeBreak.deleteMany).toHaveBeenCalledWith({ where: { employeeId: 'emp-1' } });
    expect(prisma.employeeBreak.createMany).not.toHaveBeenCalled();
    expect(result).toEqual({ breaks: [] });
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
cd apps/backend && npx jest set-employee-breaks.handler.spec.ts --no-coverage
```

Expected: FAIL — `Cannot find module './set-employee-breaks.handler'`

- [ ] **Step 4: Implement the handler**

Create `apps/backend/src/modules/people/employees/set-employee-breaks/set-employee-breaks.handler.ts`:

```typescript
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import { SetEmployeeBreaksDto } from './set-employee-breaks.dto';

export type SetEmployeeBreaksCommand = SetEmployeeBreaksDto & { employeeId: string };

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

@Injectable()
export class SetEmployeeBreaksHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(cmd: SetEmployeeBreaksCommand) {
    const { employeeId, breaks } = cmd;

    const employee = await this.prisma.employee.findFirst({ where: { id: employeeId } });
    if (!employee) throw new NotFoundException('Employee not found');

    for (const b of breaks) {
      if (timeToMinutes(b.startTime) >= timeToMinutes(b.endTime)) {
        throw new BadRequestException(
          `Break on day ${b.dayOfWeek}: startTime must be before endTime`,
        );
      }
    }

    if (breaks.length > 0) {
      const shifts = await this.prisma.employeeAvailability.findMany({
        where: { employeeId },
      });

      for (const b of breaks) {
        const dayShifts = shifts.filter((s) => s.dayOfWeek === b.dayOfWeek);
        if (dayShifts.length === 0) {
          throw new BadRequestException(
            `Break on day ${b.dayOfWeek}: no shift exists for this day`,
          );
        }
        const fits = dayShifts.some(
          (s) =>
            timeToMinutes(b.startTime) >= timeToMinutes(s.startTime) &&
            timeToMinutes(b.endTime) <= timeToMinutes(s.endTime),
        );
        if (!fits) {
          throw new BadRequestException(
            `Break on day ${b.dayOfWeek}: falls outside every shift window for that day`,
          );
        }
      }
    }

    const result = await this.prisma.$transaction(
      async (tx: Parameters<Parameters<typeof this.prisma.$transaction>[0]>[0]) => {
        await tx.employeeBreak.deleteMany({ where: { employeeId } });

        if (breaks.length > 0) {
          await tx.employeeBreak.createMany({
            data: breaks.map((b) => ({
              employeeId,
              organizationId: employee.organizationId,
              dayOfWeek: b.dayOfWeek,
              startTime: b.startTime,
              endTime: b.endTime,
            })),
          });
        }

        return tx.employeeBreak.findMany({
          where: { employeeId },
          orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
        });
      },
    );

    return { breaks: result };
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd apps/backend && npx jest set-employee-breaks.handler.spec.ts --no-coverage
```

Expected: PASS — 7 tests passing.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/modules/people/employees/set-employee-breaks/
git commit -m "feat(people): set-employee-breaks handler + tests"
```

---

### Task 4: Register handlers in PeopleModule + wire controller

**Files:**
- Modify: `apps/backend/src/modules/people/people.module.ts`
- Modify: `apps/backend/src/api/dashboard/people.controller.ts`

- [ ] **Step 1: Register handlers in PeopleModule**

In `apps/backend/src/modules/people/people.module.ts`, add these two imports near the other employee imports:

```typescript
import { GetEmployeeBreaksHandler } from './employees/get-employee-breaks/get-employee-breaks.handler';
import { SetEmployeeBreaksHandler } from './employees/set-employee-breaks/set-employee-breaks.handler';
```

Add both to the `handlers` array (after `EmployeeStatsHandler`):

```typescript
GetEmployeeBreaksHandler, SetEmployeeBreaksHandler,
```

- [ ] **Step 2: Wire the controller endpoints**

In `apps/backend/src/api/dashboard/people.controller.ts`:

**2a.** Add these imports at the top (with the other handler imports):
```typescript
import { GetEmployeeBreaksHandler } from '../../modules/people/employees/get-employee-breaks/get-employee-breaks.handler';
import { SetEmployeeBreaksHandler } from '../../modules/people/employees/set-employee-breaks/set-employee-breaks.handler';
import { SetEmployeeBreaksDto } from '../../modules/people/employees/set-employee-breaks/set-employee-breaks.dto';
```

**2b.** Add the handlers to the constructor injection (after `private readonly getAvailability: GetAvailabilityHandler`):
```typescript
private readonly getEmployeeBreaks: GetEmployeeBreaksHandler,
private readonly setEmployeeBreaks: SetEmployeeBreaksHandler,
```

**2c.** Replace the two stub endpoints (lines 277-298) with:
```typescript
@Get('employees/:id/breaks')
@ApiOperation({ summary: "Get an employee's break schedule" })
@ApiParam({ name: 'id', description: 'Employee UUID', example: '00000000-0000-0000-0000-000000000000' })
@ApiOkResponse({ description: 'Break windows for the employee' })
getBreaksEndpoint(@Param('id', ParseUUIDPipe) id: string) {
  return this.getEmployeeBreaks.execute({ employeeId: id });
}

@Put('employees/:id/breaks')
@HttpCode(HttpStatus.OK)
@ApiOperation({ summary: "Set an employee's break schedule" })
@ApiParam({ name: 'id', description: 'Employee UUID', example: '00000000-0000-0000-0000-000000000000' })
@ApiOkResponse({ description: 'Updated break windows' })
putBreaksEndpoint(
  @Param('id', ParseUUIDPipe) id: string,
  @Body() body: SetEmployeeBreaksDto,
) {
  return this.setEmployeeBreaks.execute({ employeeId: id, ...body });
}
```

- [ ] **Step 3: Typecheck**

```bash
cd apps/backend && npx tsc --noEmit 2>&1 | head -20
```

Expected: no output (0 errors).

- [ ] **Step 4: Run all people-module tests**

```bash
cd apps/backend && npx jest --testPathPattern="modules/people" --no-coverage
```

Expected: all tests pass.

- [ ] **Step 5: Rebuild OpenAPI snapshot**

```bash
cd apps/backend && npm run openapi:build-and-snapshot
```

Expected: `apps/backend/openapi.json` updated with the two break endpoints (no longer marked as placeholders).

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/modules/people/people.module.ts \
        apps/backend/src/api/dashboard/people.controller.ts \
        apps/backend/openapi.json
git commit -m "feat(people): wire break endpoints in controller + module"
```

---

### Task 5: Frontend — i18n keys + BreaksSection fix

**Files:**
- Modify: `apps/dashboard/lib/translations/en.employees.ts`
- Modify: `apps/dashboard/lib/translations/ar.employees.ts`
- Modify: `apps/dashboard/components/features/employees/breaks-section.tsx`

- [ ] **Step 1: Add missing i18n keys to English translations**

In `apps/dashboard/lib/translations/en.employees.ts`, add these 3 keys alongside the existing `employees.breaks.title` key:

```typescript
"breaks.editTitle": "Edit Breaks",
"breaks.editDesc": "Add or remove break windows for each working day.",
"breaks.noBreaks": "No breaks for this day.",
```

Also add these keys for `BreaksSection` hardcoded strings (add near the `employees.breaks.title` key):

```typescript
"breaks.loading": "Loading...",
"breaks.noBreaksConfigured": "No breaks configured.",
"breaks.editButton": "Edit Breaks",
"breaks.sectionTitle": "Breaks",
```

- [ ] **Step 2: Add missing i18n keys to Arabic translations**

In `apps/dashboard/lib/translations/ar.employees.ts`, add these 7 keys alongside the existing `employees.breaks.title` key:

```typescript
"breaks.editTitle": "تعديل الاستراحات",
"breaks.editDesc": "أضف أو احذف فترات الاستراحة لكل يوم عمل.",
"breaks.noBreaks": "لا توجد استراحات لهذا اليوم.",
"breaks.loading": "جاري التحميل...",
"breaks.noBreaksConfigured": "لا توجد استراحات محددة.",
"breaks.editButton": "تعديل الاستراحات",
"breaks.sectionTitle": "الاستراحات",
```

- [ ] **Step 3: Fix hardcoded strings in BreaksSection**

Replace the full content of `apps/dashboard/components/features/employees/breaks-section.tsx` with:

```typescript
"use client"

import { useState } from "react"
import { Button } from "@deqah/ui"
import { useLocale } from "@/components/locale-provider"
import { useEmployeeBreaks } from "@/hooks/use-employees"
import { DAY_NAME_KEYS } from "@/components/features/employees/create/schedule-types"
import { BreaksEditor } from "./breaks-editor"

interface BreaksSectionProps {
  employeeId: string
}

export function BreaksSection({ employeeId }: BreaksSectionProps) {
  const [editorOpen, setEditorOpen] = useState(false)
  const { t } = useLocale()
  const { data: breaks, isLoading } = useEmployeeBreaks(employeeId)

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {t("breaks.sectionTitle")}
        </h4>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={() => setEditorOpen(true)}
        >
          {t("breaks.editButton")}
        </Button>
      </div>

      {isLoading ? (
        <p className="text-xs text-muted-foreground">{t("breaks.loading")}</p>
      ) : !breaks || breaks.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          {t("breaks.noBreaksConfigured")}
        </p>
      ) : (
        <div className="flex flex-col gap-1">
          {breaks.map((b, i) => (
            <div
              key={b.id ?? `${b.dayOfWeek}-${i}`}
              className="flex items-center justify-between text-sm"
            >
              <span className="text-muted-foreground">
                {t(DAY_NAME_KEYS[b.dayOfWeek])}
              </span>
              <span className="tabular-nums font-medium text-foreground">
                {b.startTime} — {b.endTime}
              </span>
            </div>
          ))}
        </div>
      )}

      <BreaksEditor
        employeeId={employeeId}
        open={editorOpen}
        onOpenChange={setEditorOpen}
      />
    </div>
  )
}
```

- [ ] **Step 4: Verify i18n parity**

```bash
cd apps/dashboard && npm run i18n:verify
```

Expected: exits 0 (no parity errors).

- [ ] **Step 5: Typecheck dashboard**

```bash
cd apps/dashboard && npm run typecheck 2>&1 | head -20
```

Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add apps/dashboard/lib/translations/en.employees.ts \
        apps/dashboard/lib/translations/ar.employees.ts \
        apps/dashboard/components/features/employees/breaks-section.tsx
git commit -m "feat(dashboard): employee breaks i18n + BreaksSection fix"
```

---

### Task 6: Final verification

- [ ] **Step 1: Run full backend test suite**

```bash
cd apps/backend && npm run test -- --no-coverage 2>&1 | tail -10
```

Expected: all tests pass, 0 failures.

- [ ] **Step 2: Run dashboard tests**

```bash
cd apps/dashboard && npm run test 2>&1 | tail -10
```

Expected: all tests pass.

- [ ] **Step 3: Run backend typecheck**

```bash
cd apps/backend && npx tsc --noEmit 2>&1 | head -10
```

Expected: 0 errors.

- [ ] **Step 4: Confirm stubs are gone**

```bash
rg "no-op until|placeholder|schedule-splitting migration" apps/backend/src/api/dashboard/people.controller.ts
```

Expected: no output.
