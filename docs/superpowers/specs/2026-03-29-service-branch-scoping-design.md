# Service & Practitioner Branch Scoping — Design Spec

**Date:** 2026-03-29
**Status:** Approved

---

## Problem

Services and practitioners are currently global (clinic-wide). There is no way to restrict a service to specific branches. The requirement is:

- Services are available at **all branches by default**
- Admin can restrict a service to **one or more specific branches**
- When restricted, the service **disappears from all other branches**
- Online booking follows the same branch restriction (no separate toggle)
- Practitioners already have `PractitionerBranch` M2M — same scoping logic applies

---

## Approach

**Many-to-Many via join table** (`service_branches`) — consistent with the existing `PractitionerBranch` pattern.

**Rule:** If a service has zero `ServiceBranch` records → available at all branches. If it has records → available only at those branches.

---

## Data Layer

### New Model: `ServiceBranch`

```prisma
model ServiceBranch {
  id        String   @id @default(uuid())
  serviceId String   @map("service_id")
  branchId  String   @map("branch_id")
  createdAt DateTime @default(now()) @map("created_at")

  service Service @relation(fields: [serviceId], references: [id], onDelete: Cascade)
  branch  Branch  @relation(fields: [branchId], references: [id], onDelete: Cascade)

  @@unique([serviceId, branchId])
  @@index([branchId])
  @@map("service_branches")
}
```

### Changes to `Service` model

Add relation:
```prisma
branches ServiceBranch[]
```

### Changes to `Branch` model

Add relation:
```prisma
services ServiceBranch[]
```

### Migration

New immutable migration: `add_service_branches_table`

---

## API Layer

### Branch filtering logic (reusable where clause)

```typescript
function serviceBranchFilter(branchId?: string) {
  if (!branchId) return {};
  return {
    OR: [
      { branches: { none: {} } },           // available at all branches
      { branches: { some: { branchId } } }, // scoped to this branch
    ],
  };
}
```

Applied in:
- `GET /services` — `branchId` query param (optional)
- `GET /services/:id` — validate service is available at requested branch
- `GET /services/:id/practitioners` — filter practitioners by branch
- `POST /bookings` — validate service available at booking's branch

### New endpoints

| Method | Path | Description |
|--------|------|-------------|
| `PUT` | `/services/:id/branches` | Set branch restrictions (replaces all). Body: `{ branchIds: string[] }` |
| `DELETE` | `/services/:id/branches` | Remove all restrictions (available at all branches again) |

### DTOs

```typescript
// SetServiceBranchesDto
class SetServiceBranchesDto {
  @IsUUID('4', { each: true })
  @ArrayMinSize(1)
  branchIds: string[];
}
```

---

## Dashboard Layer

### Service form (create/edit)

New section below existing fields:

```
Branch Availability
○ Available at all branches   ← default
○ Restrict to specific branches
  └─ [Multi-select: Branch 1 ✕] [Branch 2 ✕] [+ Add branch]
```

- Toggling "all branches" → calls `DELETE /services/:id/branches`
- Saving with selected branches → calls `PUT /services/:id/branches`
- On load, if `service.branches.length > 0` → pre-select restricted mode

### Services list page

Add `Branch` filter dropdown to existing FilterBar → passes `branchId` to `GET /services`.

### Booking creation flow

When a branch is selected, the service dropdown filters automatically via `branchId` query param.

---

## Booking Validation

When creating a booking, the backend validates:
1. The selected service is available at the booking's `branchId`
2. The selected practitioner is assigned to that branch (`PractitionerBranch`)
3. Both checks use the same "none = all branches" pattern

---

## Error Handling

| Scenario | HTTP | Message |
|----------|------|---------|
| Service not available at branch | `422` | `SERVICE_NOT_AVAILABLE_AT_BRANCH` |
| Branch ID not found | `404` | `BRANCH_NOT_FOUND` |
| Setting empty branchIds array | `400` | use `DELETE` endpoint instead |

---

## Out of Scope

- Per-branch pricing overrides (separate feature)
- Online vs in-person different branch rules (online follows same branch scoping)
- Branch-scoped service categories
