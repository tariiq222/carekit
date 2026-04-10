# Department Feature — Design Spec

> Feature: Departments (organizational layer above ServiceCategory)
> Date: 2026-04-09
> Status: Approved

## Overview

Add a `Department` model as an optional organizational layer above `ServiceCategory`. Departments group service categories under clinic divisions (e.g., "Family Psychiatry" contains categories like "Initial Assessment", "Follow-up Sessions"). Controlled by a feature flag — when disabled, the system behaves exactly as before.

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Where does Department sit? | Above `ServiceCategory` via nullable `departmentId` | Zero impact on pricing/booking — purely organizational |
| Service/pricing changes? | None | `Service`, `ServiceBookingType`, `PriceResolverService` untouched |
| Feature flag system? | Use existing `FeatureFlag` model | Already has `isEnabled(key)` with caching + license tier |
| Soft delete? | Yes (`deletedAt`) | Departments are high-level — need audit trail |
| Category orphan strategy | `onDelete: SetNull` | Deleting department leaves categories intact (departmentId → null) |
| Separate module or sub-service? | Separate module (`departments/`) | Own permission scope, own controller, clean separation |

## What Changes

| Component | Change |
|-----------|--------|
| `Department` model | **New** — Prisma model in `services.prisma` |
| `ServiceCategory` model | **Modified** — add `departmentId?` + relation + index |
| `FeatureFlag` seed | **Modified** — add `departments` flag (default: false) |
| `FeatureGuard` + `@RequireFeature` | **New** — reusable guard + decorator in `common/` |
| `departments/` backend module | **New** — controller, service, DTOs |
| Seed permissions | **Modified** — add `departments` to MODULES array |
| Cache constants | **Modified** — add `DEPARTMENTS_ACTIVE` key |
| Dashboard departments page | **New** — full list page with CRUD dialogs |
| Sidebar config | **Modified** — add conditional nav item |
| i18n translations | **Modified** — add department keys (AR + EN) |
| ServiceCategory forms | **Modified** — add Department dropdown (conditional) |

## What Does NOT Change

- `Service` model — no fields added or removed
- `ServiceBookingType` / `ServiceDurationOption` — untouched
- `PractitionerService` / `PractitionerServiceType` / `PractitionerDurationOption` — untouched
- `PriceResolverService` — untouched
- `Booking` model and flow — untouched
- Any existing API endpoint behavior — untouched

---

## Phase 1: Schema

### New Model: Department

```prisma
model Department {
  id             String    @id @default(uuid())
  nameAr         String    @map("name_ar")
  nameEn         String    @map("name_en")
  descriptionAr  String?   @map("description_ar")
  descriptionEn  String?   @map("description_en")
  icon           String?
  sortOrder      Int       @default(0) @map("sort_order")
  isActive       Boolean   @default(true) @map("is_active")
  createdAt      DateTime  @default(now()) @map("created_at")
  updatedAt      DateTime  @updatedAt @map("updated_at")
  deletedAt      DateTime? @map("deleted_at")

  categories     ServiceCategory[]

  @@index([isActive, sortOrder])
  @@map("departments")
}
```

### Modified Model: ServiceCategory

Add to existing `ServiceCategory`:

```prisma
departmentId  String?     @map("department_id")
department    Department? @relation(fields: [departmentId], references: [id], onDelete: SetNull)

@@index([departmentId])
```

### Migration

```bash
prisma migrate dev --name add-departments
```

Single migration — creates `departments` table + adds `department_id` column to `service_categories`.

---

## Phase 2: Backend — FeatureGuard (Reusable)

### Decorator: `@RequireFeature(key)`

**File:** `backend/src/common/decorators/require-feature.decorator.ts`

```typescript
import { SetMetadata } from '@nestjs/common';

export const REQUIRE_FEATURE_KEY = 'require_feature';
export const RequireFeature = (featureKey: string) =>
  SetMetadata(REQUIRE_FEATURE_KEY, featureKey);
```

### Guard: `FeatureFlagGuard`

**File:** `backend/src/common/guards/feature-flag.guard.ts`

```typescript
@Injectable()
export class FeatureFlagGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private featureFlagsService: FeatureFlagsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const featureKey = this.reflector.getAllAndOverride<string | undefined>(
      REQUIRE_FEATURE_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!featureKey) return true;

    const enabled = await this.featureFlagsService.isEnabled(featureKey);
    if (!enabled) {
      throw new ForbiddenException({
        statusCode: 403,
        message: 'This feature is not available',
        error: 'FEATURE_NOT_ENABLED',
      });
    }
    return true;
  }
}
```

**Dependency:** Needs `FeatureFlagsModule` exported globally (or imported where used). `FeatureFlagsService.isEnabled(key)` checks both license tier and toggle — already cached (5 min TTL).

---

## Phase 3: Backend — Departments Module

### Structure

```
src/modules/departments/
  departments.module.ts
  departments.controller.ts
  departments.service.ts
  dto/
    create-department.dto.ts
    update-department.dto.ts
    reorder-departments.dto.ts
    department-list-query.dto.ts
```

### Controller Endpoints

| Method | Path | Guard | Permission | Description |
|--------|------|-------|------------|-------------|
| GET | `/departments` | `@Public()` + FeatureFlagGuard | — | List departments (filter: isActive, search) |
| GET | `/departments/:id` | `@Public()` + FeatureFlagGuard | — | Get one with categories count |
| POST | `/departments` | JWT + Permissions + FeatureFlag | `departments:create` | Create department |
| PATCH | `/departments/:id` | JWT + Permissions + FeatureFlag | `departments:edit` | Update department |
| DELETE | `/departments/:id` | JWT + Permissions + FeatureFlag | `departments:delete` | Soft delete |
| PATCH | `/departments/reorder` | JWT + Permissions + FeatureFlag | `departments:edit` | Bulk update sortOrder |

**Guard stack on class:**
```typescript
@UseGuards(JwtAuthGuard, PermissionsGuard, FeatureFlagGuard)
@RequireFeature('departments')
```

GET endpoints override with `@Public()` to skip JWT (FeatureFlagGuard still applies).

### Service Business Rules

**`findAll(query)`:**
- Cache with key `DEPARTMENTS_ACTIVE`, TTL 900s (15 min)
- Filter: `deletedAt IS NULL`, optional `isActive`, optional `search` (nameAr/nameEn ILIKE)
- Include: `_count: { categories: { where: { isActive: true } } }`
- Order: `sortOrder ASC`
- Paginated: `page`, `perPage` (default 20)

**`findOne(id)`:**
- Include categories count
- Throw `NotFoundException` if not found or soft-deleted

**`create(dto)`:**
- Fields: nameAr, nameEn, descriptionAr?, descriptionEn?, icon?, sortOrder?, isActive?
- Invalidate cache

**`update(id, dto)`:**
- Partial update — any field optional
- Invalidate cache

**`delete(id)`:**
- Soft delete: set `deletedAt = now()`
- Categories with this departmentId stay (SetNull handles via Prisma)
- Invalidate cache

**`reorder(items)`:**
- Input: `Array<{ id: string, sortOrder: number }>`
- `$transaction` — update each department's sortOrder
- Invalidate cache

### DTOs

**CreateDepartmentDto:**
```typescript
nameAr: @IsString() @IsNotEmpty() @MaxLength(255)
nameEn: @IsString() @IsNotEmpty() @MaxLength(255)
descriptionAr?: @IsOptional() @IsString() @MaxLength(1000)
descriptionEn?: @IsOptional() @IsString() @MaxLength(1000)
icon?: @IsOptional() @IsString() @MaxLength(100)
sortOrder?: @IsOptional() @IsInt() @Min(0)
isActive?: @IsOptional() @IsBoolean()
```

**UpdateDepartmentDto:** Same fields, all `@IsOptional()`.

**ReorderDepartmentsDto:**
```typescript
items: @IsArray() @ValidateNested({ each: true })
  // each: { id: @IsUUID(), sortOrder: @IsInt() @Min(0) }
```

**DepartmentListQueryDto:**
```typescript
page?: @IsOptional() @Type(() => Number) @IsInt() @Min(1)
perPage?: @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
search?: @IsOptional() @IsString()
isActive?: @IsOptional() @Transform(({ value }) => value === 'true')
```

### Cache Constants

Add to `backend/src/config/constants/cache.ts`:

```typescript
CACHE_KEYS.DEPARTMENTS_ACTIVE = 'cache:departments:active'
CACHE_TTL.DEPARTMENTS_LIST = 900  // 15 minutes
```

### Module Registration

**`departments.module.ts`:**
```typescript
@Module({
  imports: [FeatureFlagsModule],  // For FeatureFlagGuard
  controllers: [DepartmentsController],
  providers: [DepartmentsService],
  exports: [DepartmentsService],
})
export class DepartmentsModule {}
```

Register in `app.module.ts` imports array.

---

## Phase 4: Seed Data

### MODULES array

Add `'departments'` to `MODULES` in `seed.data.ts`. This auto-generates 4 permissions: `departments:view`, `departments:create`, `departments:edit`, `departments:delete`.

### FEATURE_FLAGS array

Add:
```typescript
{
  key: 'departments',
  enabled: false,
  nameAr: 'الأقسام',
  nameEn: 'Departments',
  descriptionAr: 'تفعيل نظام الأقسام لتصنيف الخدمات',
  descriptionEn: 'Enable departments to organize service categories',
}
```

### ROLES permissions

| Role | departments permissions |
|------|------------------------|
| super_admin | view, create, edit, delete |
| admin | view, create, edit, delete |
| receptionist | view |
| accountant | view |
| practitioner | view |
| patient | view |

---

## Phase 5: Dashboard

### Files to Create

| File | Purpose | Max Lines |
|------|---------|-----------|
| `app/(dashboard)/departments/page.tsx` | Route → delegates to list component | 10 |
| `components/features/departments/department-list-page.tsx` | List page with stats, filters, table | 250 |
| `components/features/departments/department-columns.tsx` | TanStack Table column definitions | 120 |
| `components/features/departments/create-department-dialog.tsx` | Sheet dialog for creating | 130 |
| `components/features/departments/edit-department-dialog.tsx` | Sheet dialog for editing | 140 |
| `components/features/departments/delete-department-dialog.tsx` | AlertDialog for confirming delete | 80 |
| `hooks/use-departments.ts` | TanStack Query hooks + filter state | 100 |
| `lib/api/departments.ts` | API client functions | 50 |
| `lib/types/department.ts` | TypeScript interfaces | 40 |
| `lib/schemas/department.schema.ts` | Zod validation schema | 20 |

### Files to Modify

| File | Change |
|------|--------|
| `lib/query-keys.ts` | Add `departments` key group |
| `components/sidebar-config.ts` | Add departments nav item to `clinicNav` |
| `hooks/use-sidebar-nav.ts` | Add `"/departments": "departments"` to feature flag map |
| `lib/translations/en.ops.ts` | Add ~40 department translation keys |
| `lib/translations/ar.ops.ts` | Add ~40 department translation keys |

### Page Anatomy

```
Breadcrumbs
PageHeader: "Departments" + description | [+ Add Department]
StatsGrid: 3x StatCard (Total/primary, Active/success, Inactive/warning)
FilterBar: [Search] [Status dropdown] [Reset]
DataTable: nameAr/nameEn, description, categories count, status badge, actions
Pagination (if totalPages > 1)
Dialogs: Create Sheet, Edit Sheet, Delete AlertDialog
```

### Stats

| Stat | Source | Icon Color |
|------|--------|------------|
| Total Departments | `meta.total` | primary |
| Active | count where `isActive = true` | success |
| Inactive | count where `isActive = false` | warning |

### Table Columns

| Column | Content |
|--------|---------|
| Name | `nameAr` primary + `nameEn` secondary (or vice versa by locale) |
| Description | `descriptionAr` or `descriptionEn` by locale, truncated |
| Categories | Count badge |
| Status | Active (success badge) / Inactive (muted badge) |
| Actions | Dropdown: Edit, Delete |

### Component Patterns

All components follow existing patterns documented in `dashboard/CLAUDE.md`:
- `react-hook-form` + `zodResolver` for forms
- `Sheet` (side panel) for create/edit
- `AlertDialog` for delete confirmation
- `toast` from `sonner` for success/error feedback
- `useDepartmentMutations()` returns `createMut`, `updateMut`, `deleteMut`
- All mutations invalidate `queryKeys.departments.all`
- Skeleton loading: 3x `h-24` for stats, 5x `h-12` for table rows

### Design System Compliance

- Glass surfaces (`.glass`, `.glass-solid`)
- Semantic tokens only (no hex, no `text-gray-*`)
- RTL spacing (`ps-`/`pe-`/`ms-`/`me-`, `start`/`end`)
- HugeIcons only (`@hugeicons/core-free-icons`)
- `tabular-nums` on numeric values
- Status badges: `bg-success/10 text-success border-success/30` (active) / `bg-muted text-muted-foreground` (inactive)

---

## Phase 6: ServiceCategory Form Update

Modify the existing ServiceCategory create/edit form (inside the services module) to add a **Department dropdown** — visible only when `departments` feature flag is enabled.

**Approach:**
- Use `useFeatureFlagMap()` to check `isEnabled("departments")`
- If enabled: show `<DepartmentSelect>` dropdown populated from `GET /departments?isActive=true`
- If disabled: hide dropdown, `departmentId` stays null
- On save: include `departmentId` in the create/update DTO

**Backend change:** Update `CreateCategoryDto` and `UpdateCategoryDto` to accept optional `departmentId`:
```typescript
departmentId?: @IsOptional() @IsUUID()
```

Update `ServiceCategoriesService.create()` and `update()` to pass `departmentId` to Prisma.

---

## Phase 7: i18n

### English Keys (added to `en.ops.ts`)

```
nav.departments, departments.title, departments.description,
departments.addDepartment, departments.searchPlaceholder,
departments.stats.total, departments.stats.active, departments.stats.inactive,
departments.empty.title, departments.empty.description,
departments.col.name, departments.col.description, departments.col.categories,
departments.col.status,
departments.status.active, departments.status.inactive,
departments.action.edit, departments.action.delete,
departments.filters.allStatuses,
departments.field.nameEn, departments.field.nameAr,
departments.field.descriptionEn, departments.field.descriptionAr,
departments.field.icon, departments.field.isActive,
departments.create.title, departments.create.description,
departments.create.cancel, departments.create.submit, departments.create.submitting,
departments.create.success, departments.create.error,
departments.edit.title, departments.edit.description,
departments.edit.cancel, departments.edit.submit, departments.edit.submitting,
departments.edit.success, departments.edit.error,
departments.delete.title, departments.delete.description,
departments.delete.cancel, departments.delete.submit, departments.delete.submitting,
departments.delete.success, departments.delete.error
```

### Arabic Keys (added to `ar.ops.ts`)

Mirror of English keys with Arabic values.

---

## Verification Checklist

- [ ] `enableDepartments = false` → departments sidebar hidden, API returns 403, category forms have no department dropdown
- [ ] `enableDepartments = true` → sidebar visible, CRUD works, categories can be assigned to departments
- [ ] Deleting a department → soft delete, categories keep `departmentId = null`
- [ ] Reorder → sortOrder updates atomically
- [ ] Cache invalidated on create/update/delete/reorder
- [ ] Old booking flow unchanged — Service → PractitionerService → Booking
- [ ] All money/pricing untouched
- [ ] No file exceeds 350 lines
- [ ] RTL layout correct
- [ ] AR + EN labels on all UI elements
- [ ] Dashboard design system compliance (glass, tokens, HugeIcons)
