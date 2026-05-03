# Employee Breaks — Design Spec
**Date:** 2026-05-03
**Status:** Approved

## Context

`GET /dashboard/people/employees/:id/breaks` and `PUT /dashboard/people/employees/:id/breaks` currently return `[]` (no-op stubs in `people.controller.ts:277-298`). The frontend (`BreaksEditor`, `BreaksSection`, `useEmployeeBreaks`, `useSetBreaks`) is fully wired and waiting for a real backend.

The existing `EmployeeAvailability` schema uses multiple rows per `(employeeId, dayOfWeek)` to represent split shifts — the gap between shifts is conceptually a break. This feature introduces `EmployeeBreak` as a separate, explicit entity so the frontend can manage breaks independently without touching the split-shift logic.

## Scope

- **Backend:** Prisma schema + migration, two vertical-slice handlers, people.module.ts registration, controller wiring
- **Frontend:** Add 3 missing i18n keys, fix hardcoded English day names in `BreaksSection`

## Data Model

Add to `apps/backend/prisma/schema/people.prisma`:

```prisma
model EmployeeBreak {
  id             String   @id @default(uuid())
  organizationId String
  employeeId     String
  employee       Employee @relation(fields: [employeeId], references: [id], onDelete: Cascade)
  dayOfWeek      Int      // 0=Sun … 6=Sat
  startTime      String   // HH:MM
  endTime        String   // HH:MM
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  @@index([employeeId, dayOfWeek])
  @@index([organizationId])
}
```

Add `breaks EmployeeBreak[]` relation to the `Employee` model.

Migration name: `20260503080000_add_employee_break`

## Backend Slices

### `get-employee-breaks`

**File:** `apps/backend/src/modules/people/employees/get-employee-breaks/get-employee-breaks.handler.ts`

- Command: `{ employeeId: string }`
- Throws `NotFoundException` if employee not found
- Returns `{ breaks: EmployeeBreak[] }` ordered by `(dayOfWeek asc, startTime asc)`

### `set-employee-breaks`

**File:** `apps/backend/src/modules/people/employees/set-employee-breaks/`
- `set-employee-breaks.dto.ts` — DTO with `breaks: BreakWindowDto[]`
- `set-employee-breaks.handler.ts` — handler

**DTO shape:**
```ts
class BreakWindowDto {
  @IsInt() @Min(0) @Max(6) dayOfWeek: number
  @IsString() @Matches(/^\d{2}:\d{2}$/) startTime: string
  @IsString() @Matches(/^\d{2}:\d{2}$/) endTime: string
}

class SetEmployeeBreaksDto {
  @IsArray() @ValidateNested({ each: true }) @Type(() => BreakWindowDto)
  breaks: BreakWindowDto[]
}
```

**Command:** `SetEmployeeBreaksDto & { employeeId: string }`

**Validation (in handler, before transaction):**
1. Throw `NotFoundException` if employee not found
2. For each break: `startTime` must be strictly before `endTime` → `BadRequestException`
3. For each break: at least one `EmployeeAvailability` row must exist for the same `(employeeId, dayOfWeek)` where `break.startTime >= shift.startTime` AND `break.endTime <= shift.endTime` → `BadRequestException("Break on day X falls outside any shift")`

**Transaction:** `deleteMany({ where: { employeeId } })` then `createMany(...)` — same pattern as `update-availability.handler.ts`

**Returns:** `{ breaks: EmployeeBreak[] }` (the newly inserted rows, ordered same as GET)

### `people.module.ts` changes

- Import and add `GetEmployeeBreaksHandler`, `SetEmployeeBreaksHandler` to `handlers` array
- Export both handlers

### `people.controller.ts` changes

- Inject `GetEmployeeBreaksHandler` and `SetEmployeeBreaksHandler`
- Replace stub `getBreaksEndpoint` → call `getEmployeeBreaks.execute({ employeeId: id })`
- Replace stub `putBreaksEndpoint` → call `setEmployeeBreaks.execute({ employeeId: id, ...body })` with `@Body() body: SetEmployeeBreaksDto`
- Update `@ApiOperation` summaries (remove "placeholder")
- Run `npm run openapi:build-and-snapshot` after wiring

## Frontend Changes

### i18n keys

Add to `apps/dashboard/lib/translations/en.employees.ts`:
```ts
"breaks.editTitle": "Edit Breaks",
"breaks.editDesc": "Add or remove break windows for each working day.",
"breaks.noBreaks": "No breaks for this day.",
```

Add to `apps/dashboard/lib/translations/ar.employees.ts`:
```ts
"breaks.editTitle": "تعديل الاستراحات",
"breaks.editDesc": "أضف أو احذف فترات الاستراحة لكل يوم عمل.",
"breaks.noBreaks": "لا توجد استراحات لهذا اليوم.",
```

### `BreaksSection` — fix hardcoded day names

`apps/dashboard/components/features/employees/breaks-section.tsx` uses a hardcoded English `DAY_NAMES` constant and the string `"Breaks"` / `"Edit Breaks"` / `"Loading..."` / `"No breaks configured."` directly. Replace all hardcoded strings with `t()` calls using existing keys where possible and the new keys above.

Day names: use `t("schedule.days.sun")` … `t("schedule.days.sat")` — verify these keys exist; if they don't, add them to both translation files.

## Validation Rules Summary

| Rule | Error |
|------|-------|
| `startTime >= endTime` | `400 Bad Request` |
| No shift exists for `dayOfWeek` | `400 Bad Request` |
| Break falls outside every shift for that day | `400 Bad Request` |
| Employee not found | `404 Not Found` |

## Tests

Each handler gets a colocated `*.handler.spec.ts`:

**`get-employee-breaks.handler.spec.ts`:**
- Returns empty array when no breaks
- Returns breaks ordered by `(dayOfWeek, startTime)`
- Throws 404 when employee not found

**`set-employee-breaks.handler.spec.ts`:**
- Replaces all breaks on success
- Returns newly created breaks ordered
- Throws 400 when `startTime >= endTime`
- Throws 400 when no shift exists for the day
- Throws 400 when break falls outside shift window
- Throws 404 when employee not found

## Files Changed

```
apps/backend/prisma/schema/people.prisma                              (model + relation)
apps/backend/prisma/migrations/20260503080000_add_employee_break/     (new migration)
apps/backend/src/modules/people/employees/get-employee-breaks/        (new slice)
apps/backend/src/modules/people/employees/set-employee-breaks/        (new slice)
apps/backend/src/modules/people/people.module.ts                      (register handlers)
apps/backend/src/api/dashboard/people.controller.ts                   (wire endpoints)
apps/backend/openapi.json                                             (snapshot update)
apps/dashboard/lib/translations/ar.employees.ts                       (3 new keys)
apps/dashboard/lib/translations/en.employees.ts                       (3 new keys)
apps/dashboard/components/features/employees/breaks-section.tsx       (i18n fix)
```

## Out of Scope

- No changes to booking availability-check logic (breaks are not yet enforced during slot generation)
- No changes to `EmployeeAvailability` or split-shift logic
- Mobile app — breaks are not surfaced in mobile UI
