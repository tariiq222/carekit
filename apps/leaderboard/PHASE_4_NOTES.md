# Phase 4 — Wiring TODO for parent

## packages/api-client/src/index.ts

NOTE: I had to add these exports myself because hooks failed typecheck without them.
Verify and keep:

```ts
export * as servicesApi from './modules/services.js'
export * as branchesApi from './modules/branches.js'
export * as departmentsApi from './modules/departments.js'
export * as specialtiesApi from './modules/specialties.js'
```

## packages/api-client/src/types/index.ts

I also added type re-exports here (own files):

```ts
export type {
  ServiceCategory, ServiceListItem, ServiceStats, ServiceListQuery,
  ServiceListResponse, CreateServicePayload, UpdateServicePayload,
} from './service.js'
export type {
  BranchListItem, BranchListQuery, BranchListResponse,
  CreateBranchPayload, UpdateBranchPayload,
} from './branch.js'
export type {
  DepartmentListItem, DepartmentListQuery, DepartmentListResponse,
  CreateDepartmentPayload, UpdateDepartmentPayload,
} from './department.js'
export type {
  SpecialtyListItem, CreateSpecialtyPayload, UpdateSpecialtyPayload,
} from './specialty.js'
```

## apps/leaderboard/src/lib/query-keys.ts — add these keys

The file already has partial entries for `services` and `branches` (no stats key).
Replace those entries and add `departments` + `specialties`:

```ts
services: {
  all: ['services'] as const,
  list: (params: Record<string, unknown>) => ['services', 'list', params] as const,
  stats: ['services', 'stats'] as const,
  detail: (id: string) => ['services', id] as const,
},
branches: {
  all: ['branches'] as const,
  list: (params: Record<string, unknown>) => ['branches', 'list', params] as const,
  detail: (id: string) => ['branches', id] as const,
},
departments: {
  all: ['departments'] as const,
  list: (params: Record<string, unknown>) => ['departments', 'list', params] as const,
  detail: (id: string) => ['departments', id] as const,
},
specialties: {
  all: ['specialties'] as const,
  list: ['specialties', 'list'] as const,
  detail: (id: string) => ['specialties', id] as const,
},
```

After adding, replace the inline `keys` objects in:
- `apps/leaderboard/src/hooks/use-services.ts`
- `apps/leaderboard/src/hooks/use-branches.ts`
- `apps/leaderboard/src/hooks/use-departments.ts`
- `apps/leaderboard/src/hooks/use-specialties.ts`

with `QUERY_KEYS.services` / `QUERY_KEYS.branches` / etc.

## Sidebar wiring TODO

Add these entries to the dashboard sidebar (in display order suggested):

| Label (AR) | Route | Icon (HugeIcon) |
|------------|-------|-----------------|
| الخدمات | `/services` | `hgi-stethoscope` |
| الفروع | `/branches` | `hgi-building-03` |
| الأقسام | `/departments` | `hgi-folder-02` |
| التخصصات | `/specialties` | `hgi-medical-mask` |

## Backend endpoint notes (decisions made)

- **Services**: backend uses `nameAr`/`nameEn` (not `name`/`nameAr`). Stats endpoint
  is `GET /services/list-stats` returning `{ total, active, inactive }`. Price is in
  halalat (cents) — divided by 100 for display in list page. Create requires
  `categoryId` (UUID). Delete uses soft-delete (`{ deleted: true }`).
- **Branches**: requires `multi_branch` feature flag on backend. No `list-stats`
  endpoint — list page derives stats from current page (total from `meta.total`).
  Has `isMain` flag and `timezone` field.
- **Departments**: requires `departments` feature flag. No `list-stats` endpoint —
  derives stats from current page. Has `sortOrder` and `icon` (icon name string,
  not URL).
- **Specialties**: NON-paginated — `GET /specialties` returns a flat array filtered
  to `isActive: true`. The list page does client-side search-only filtering.
  Specialty has `iconUrl` (URL string, not icon name). Permissions are bound to
  `practitioners` module on backend (create/edit/delete).

## Mismatches / decisions to confirm

1. **Services list page — "إجمالي الفئات" stat**: backend `getListStats` only
   returns `{ total, active, inactive }`. I used current-page count for the 4th
   stat card to satisfy the "4 cards" Page Anatomy Law. Consider adding a real
   category-count stat to backend if you want a meaningful 4th card.
2. **Branches/Departments stats**: derived from current page only (no backend
   stats endpoint). Active/inactive counts only reflect current page contents.
   Consider adding `list-stats` endpoints to backend for accurate global stats.
3. **Specialties pagination**: backend returns a flat array. The list page does
   client-side filtering. If specialty count grows, consider adding pagination
   support to backend.
4. **CreateService form**: `categoryId` is currently a free-text UUID input.
   Should be a Select populated from `GET /services/categories`. Defer to a
   later phase that adds the categories sub-resource hook.
5. **Export buttons**: present in PageHeader per Page Anatomy Law but not wired —
   only services backend has `/services/export` CSV endpoint. Branches /
   departments / specialties have no export endpoint. Buttons are placeholders.
6. **Soft "active filter on backend"**: services backend `findAll` defaults
   `isActive: true` when query.isActive is undefined. The list page sends
   `isActive: undefined` for "All" filter — this still hides inactive services.
   To see inactive services, user must explicitly pick "غير نشط".
