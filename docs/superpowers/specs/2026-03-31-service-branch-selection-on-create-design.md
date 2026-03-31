# Service Branch Selection on Create — Design Spec

**Date:** 2026-03-31  
**Status:** Approved

## Problem

When creating a new service, the branch restriction UI shows a static placeholder: "يمكنك تحديد الفروع بعد حفظ الخدمة". This forces a two-step flow (create → edit → set branches), whereas practitioners are already selectable during creation. The UX is inconsistent and adds unnecessary friction.

## Goal

Allow branch selection during service creation, matching the practitioner selection pattern. Branches are sent with the create payload in a single atomic request.

---

## Backend Changes

### 1. `backend/src/modules/services/dto/create-service.dto.ts`

Add `branchIds` field identical in structure to the existing `practitionerIds`:

```ts
@ApiPropertyOptional()
@IsOptional()
@IsArray()
@IsUUID('4', { each: true })
branchIds?: string[];
```

### 2. `backend/src/modules/services/services.service.ts` — `create()` method

Inside the `prisma.service.create()` call, add `serviceBranches` alongside the existing `practitionerServices`:

```ts
...(dto.branchIds?.length && {
  serviceBranches: {
    create: dto.branchIds.map((branchId) => ({ branchId })),
  },
}),
```

This runs inside the same Prisma transaction — atomic, no partial state possible.

---

## Frontend Changes

### 3. `dashboard/lib/types/service-payloads.ts`

Add `branchIds?: string[]` to `CreateServicePayload`.

### 4. `dashboard/components/features/services/create/form-schema.ts`

Add to schema:
```ts
branchIds: z.array(z.string().uuid()).optional()
```

Add to defaults:
```ts
branchIds: [],  // empty = all branches
```

### 5. New component: `dashboard/components/features/services/service-branches-picker.tsx`

A form-state-only branch picker (no API calls). Used exclusively in create mode.

**Props:**
```ts
interface ServiceBranchesPickerProps {
  value: string[]           // selected branchIds from form
  onChange: (ids: string[]) => void
}
```

**UX:**
- RadioGroup: "جميع الفروع" (default) | "فروع محددة"
- When "فروع محددة" selected: renders checkbox list of all branches (fetched via `useBranches`)
- Loading state: skeleton
- No branches in system: empty state with link to `/branches/new`
- Selecting "جميع الفروع" clears the selection (sets `[]`)

Visual structure mirrors `ServiceBranchesTab` but without `setMut`/`clearMut` calls.

### 6. `dashboard/components/features/services/create/basic-info-tab.tsx`

Replace the current placeholder block (the `!serviceId` early return content) with `ServiceBranchesPicker`:

```tsx
<ServiceBranchesPicker
  value={form.watch("branchIds") ?? []}
  onChange={(ids) => form.setValue("branchIds", ids)}
/>
```

Pass `branchIds` in `onSubmit` payload:
```ts
branchIds: data.branchIds?.length ? data.branchIds : undefined
```
(undefined = no restriction = all branches, matching backend default)

### 7. `ServiceBranchesTab` (edit mode) — No changes

Remains API-driven as-is. The two components serve different contexts:
- **Create**: `ServiceBranchesPicker` (form state only)
- **Edit**: `ServiceBranchesTab` (live API mutations)

---

## Data Flow

```
User selects branches in form
       ↓
form.watch("branchIds") = ["uuid1", "uuid2"]
       ↓
onSubmit → createService({ ...payload, branchIds: ["uuid1", "uuid2"] })
       ↓
POST /services  →  CreateServiceDto.branchIds
       ↓
prisma.service.create({ data: { ...serviceData, serviceBranches: { create: [...] } } })
       ↓
Service + ServiceBranch records created atomically
```

---

## Edge Cases

| Case | Behavior |
|------|----------|
| No branches selected | `branchIds: undefined` → no `serviceBranches` created → available in all branches |
| All branches checked | Same as above (redundant records avoided) |
| Branch fetch fails | Show error state, user can still create without branch restriction |
| Single branch system | Picker still shown, user may restrict or leave unrestricted |

---

## Files Touched

| File | Change |
|------|--------|
| `backend/.../dto/create-service.dto.ts` | Add `branchIds` field |
| `backend/.../services.service.ts` | Add `serviceBranches` create in `create()` |
| `dashboard/lib/types/service-payloads.ts` | Add `branchIds` to `CreateServicePayload` |
| `dashboard/.../create/form-schema.ts` | Add `branchIds` field + default |
| `dashboard/.../services/service-branches-picker.tsx` | New component |
| `dashboard/.../create/basic-info-tab.tsx` | Replace placeholder with picker, pass branchIds in submit |
