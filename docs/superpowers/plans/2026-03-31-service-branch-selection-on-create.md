# Service Branch Selection on Create — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow branch selection during service creation so branches are saved atomically with the service, matching the employee selection pattern.

**Architecture:** Add `branchIds` to the backend `CreateServiceDto` and handle it inside `services.service.ts` `create()` using a Prisma nested write (same transaction). On the frontend, add a new form-state-only `ServiceBranchesPicker` component, wire it into the create form schema and `basic-info-tab`, and pass `branchIds` in the create payload.

**Tech Stack:** NestJS + Prisma (backend), Next.js 15 + React Hook Form + Zod + TanStack Query + shadcn/ui (frontend)

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `backend/src/modules/services/dto/create-service.dto.ts` | Modify | Add `branchIds` field |
| `backend/src/modules/services/services.service.ts` | Modify | Create `serviceBranches` records in `create()` |
| `dashboard/lib/types/service-payloads.ts` | Modify | Add `branchIds` to `CreateServicePayload` |
| `dashboard/components/features/services/create/form-schema.ts` | Modify | Add `branchIds` field + default |
| `dashboard/components/features/services/service-branches-picker.tsx` | Create | Form-state-only branch picker UI |
| `dashboard/components/features/services/create/basic-info-tab.tsx` | Modify | Replace placeholder, wire picker, pass branchIds in submit |

---

## Task 1: Backend — Add `branchIds` to DTO

**Files:**
- Modify: `backend/src/modules/services/dto/create-service.dto.ts`

- [ ] **Step 1: Add the field**

Open `backend/src/modules/services/dto/create-service.dto.ts`. After the `employeeIds` field (currently the last field, lines 144–148), add:

```ts
  @ApiPropertyOptional({ type: [String], description: 'Branch UUIDs to restrict this service atomically on create' })
  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  branchIds?: string[];
```

The closing `}` of the class stays at the end.

- [ ] **Step 2: Verify types compile**

```bash
cd backend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add backend/src/modules/services/dto/create-service.dto.ts
git commit -m "feat(backend/services): add branchIds to CreateServiceDto"
```

---

## Task 2: Backend — Wire `branchIds` into `create()` service method

**Files:**
- Modify: `backend/src/modules/services/services.service.ts` (around line 71–81)

- [ ] **Step 1: Add `serviceBranches` nested write**

In `services.service.ts`, find the `prisma.service.create()` call inside `create()`. It currently looks like:

```ts
const service = await this.prisma.service.create({
  data: {
    ...serviceData,
    ...(dto.employeeIds?.length && {
      employeeServices: {
        create: dto.employeeIds.map((employeeId) => ({ employeeId })),
      },
    }),
  },
  include: { category: true },
});
```

Replace it with:

```ts
const service = await this.prisma.service.create({
  data: {
    ...serviceData,
    ...(dto.employeeIds?.length && {
      employeeServices: {
        create: dto.employeeIds.map((employeeId) => ({ employeeId })),
      },
    }),
    ...(dto.branchIds?.length && {
      serviceBranches: {
        create: dto.branchIds.map((branchId) => ({ branchId })),
      },
    }),
  },
  include: { category: true },
});
```

- [ ] **Step 2: Verify types compile**

```bash
cd backend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Run unit tests**

```bash
cd backend && npm run test
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add backend/src/modules/services/services.service.ts
git commit -m "feat(backend/services): create serviceBranches atomically on service create"
```

---

## Task 3: Frontend — Type + Schema

**Files:**
- Modify: `dashboard/lib/types/service-payloads.ts`
- Modify: `dashboard/components/features/services/create/form-schema.ts`

- [ ] **Step 1: Add `branchIds` to `CreateServicePayload`**

In `dashboard/lib/types/service-payloads.ts`, find `CreateServicePayload`. After the `employeeIds?: string[]` line (currently last field), add:

```ts
  branchIds?: string[]
```

- [ ] **Step 2: Add `branchIds` to form schema**

In `dashboard/components/features/services/create/form-schema.ts`, add to `createServiceSchema`:

```ts
  branchIds: z.array(z.string().uuid()).optional(),
```

And in `createServiceDefaults`:

```ts
  branchIds: [],
```

- [ ] **Step 3: Typecheck**

```bash
cd dashboard && npm run typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add dashboard/lib/types/service-payloads.ts \
        dashboard/components/features/services/create/form-schema.ts
git commit -m "feat(dashboard/services): add branchIds to CreateServicePayload and form schema"
```

---

## Task 4: Frontend — `ServiceBranchesPicker` component

**Files:**
- Create: `dashboard/components/features/services/service-branches-picker.tsx`

This is a pure form-state component — no API mutations. It fetches branches for display only (read), and reports selections via `onChange`.

- [ ] **Step 1: Create the file**

Create `dashboard/components/features/services/service-branches-picker.tsx`:

```tsx
"use client"

import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Skeleton } from "@/components/ui/skeleton"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Button } from "@/components/ui/button"
import { HugeiconsIcon } from "@hugeicons/react"
import { Add01Icon, Building04Icon } from "@hugeicons/core-free-icons"
import { useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { fetchBranches } from "@/lib/api/branches"
import { queryKeys } from "@/lib/query-keys"
import { useLocale } from "@/components/locale-provider"

/* ─── Props ─── */

interface ServiceBranchesPickerProps {
  value: string[]
  onChange: (ids: string[]) => void
}

/* ─── Component ─── */

export function ServiceBranchesPicker({ value, onChange }: ServiceBranchesPickerProps) {
  const { t, locale } = useLocale()
  const router = useRouter()

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.branches.list({ page: 1, perPage: 100 }),
    queryFn: () => fetchBranches({ page: 1, perPage: 100 }),
    staleTime: 5 * 60 * 1000,
  })

  const branches = data?.items ?? []
  const mode = value.length === 0 ? "all" : "specific"

  const handleModeChange = (next: "all" | "specific") => {
    if (next === "all") {
      onChange([])
    } else {
      // Keep existing selection if switching back to specific
    }
  }

  const handleToggle = (branchId: string, checked: boolean) => {
    if (checked) {
      onChange([...value, branchId])
    } else {
      onChange(value.filter((id) => id !== branchId))
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
      </div>
    )
  }

  if (branches.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-surface p-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
            <HugeiconsIcon icon={Building04Icon} strokeWidth={1.5} className="size-5 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">{t("services.branches.noBranchesHint")}</p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="shrink-0 gap-1.5 text-xs"
          onClick={() => router.push("/branches/new")}
        >
          <HugeiconsIcon icon={Add01Icon} strokeWidth={2} className="size-3.5" />
          {t("services.branches.addBranch")}
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <RadioGroup
        value={mode}
        onValueChange={(v) => handleModeChange(v as "all" | "specific")}
        dir={locale === "ar" ? "rtl" : "ltr"}
      >
        <div className="flex items-center gap-2">
          <RadioGroupItem value="all" id="picker-branches-all" />
          <Label htmlFor="picker-branches-all" className="cursor-pointer text-sm">
            {t("services.branches.allBranchesLabel")}
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <RadioGroupItem value="specific" id="picker-branches-specific" />
          <Label htmlFor="picker-branches-specific" className="cursor-pointer text-sm">
            {t("services.branches.specificLabel")}
          </Label>
        </div>
      </RadioGroup>

      {mode === "specific" && (
        <div
          className="rounded-lg border border-border p-4 flex flex-col gap-3"
          dir={locale === "ar" ? "rtl" : "ltr"}
        >
          {branches.map((branch) => (
            <div key={branch.id} className="flex items-center gap-2">
              <Checkbox
                id={`picker-branch-${branch.id}`}
                checked={value.includes(branch.id)}
                onCheckedChange={(checked) => handleToggle(branch.id, !!checked)}
              />
              <Label htmlFor={`picker-branch-${branch.id}`} className="cursor-pointer text-sm">
                {locale === "ar" ? branch.nameAr : branch.nameEn}
              </Label>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

```bash
cd dashboard && npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add dashboard/components/features/services/service-branches-picker.tsx
git commit -m "feat(dashboard/services): add ServiceBranchesPicker form-state component"
```

---

## Task 5: Frontend — Wire picker into `basic-info-tab` + pass in submit

**Files:**
- Modify: `dashboard/components/features/services/create/basic-info-tab.tsx`

The file currently:
1. Renders `ServiceBranchesTab` which shows a static placeholder when `serviceId` is undefined
2. Does not include `branchIds` in any submit payload (submit lives in the parent dialog/wizard)

We need to:
- Import `ServiceBranchesPicker`
- Add `branchIds` to `form.watch()`
- Replace `ServiceBranchesTab` with `ServiceBranchesPicker` when in create mode (`!serviceId`)
- Remove the status badge that references `serviceBranches` when in create mode

- [ ] **Step 1: Update imports**

In `basic-info-tab.tsx`, replace:

```tsx
import { ServiceBranchesTab } from "@/components/features/services/service-branches-tab"
```

with:

```tsx
import { ServiceBranchesTab } from "@/components/features/services/service-branches-tab"
import { ServiceBranchesPicker } from "@/components/features/services/service-branches-picker"
```

- [ ] **Step 2: Add `branchIds` to `form.watch()`**

In the destructuring of `form.watch()`, add `branchIds`:

```ts
const {
  isActive,
  isHidden,
  hidePriceOnBooking,
  hideDurationOnBooking,
  categoryId: watchedCategoryId,
  iconName,
  iconBgColor,
  branchIds,          // add this
} = form.watch()
```

- [ ] **Step 3: Replace the branch section UI**

Find the branch section (around lines 183–202). Currently it renders:

```tsx
<div className="rounded-lg border border-border bg-surface-muted px-4 py-3 flex flex-col gap-3">
  <div className="flex items-center justify-between gap-2">
    <p className="text-sm font-medium text-foreground">{t("services.branches.title")}</p>
    {serviceBranches !== undefined && (
      <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${
        serviceBranches.length > 0
          ? "border-warning/30 bg-warning/10 text-warning"
          : "border-success/30 bg-success/10 text-success"
      }`}>
        {serviceBranches.length > 0
          ? (locale === "ar" ? `${serviceBranches.length} فروع` : `${serviceBranches.length} branches`)
          : (locale === "ar" ? "جميع الفروع" : "All branches")}
      </span>
    )}
  </div>
  <p className="text-xs text-muted-foreground">{t("services.branches.cardDesc")}</p>
  <ServiceBranchesTab serviceId={serviceId} serviceBranches={serviceBranches} />
</div>
```

Replace with:

```tsx
<div className="rounded-lg border border-border bg-surface-muted px-4 py-3 flex flex-col gap-3">
  <div className="flex items-center justify-between gap-2">
    <p className="text-sm font-medium text-foreground">{t("services.branches.title")}</p>
    {serviceId && serviceBranches !== undefined && (
      <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${
        serviceBranches.length > 0
          ? "border-warning/30 bg-warning/10 text-warning"
          : "border-success/30 bg-success/10 text-success"
      }`}>
        {serviceBranches.length > 0
          ? (locale === "ar" ? `${serviceBranches.length} فروع` : `${serviceBranches.length} branches`)
          : (locale === "ar" ? "جميع الفروع" : "All branches")}
      </span>
    )}
  </div>
  <p className="text-xs text-muted-foreground">{t("services.branches.cardDesc")}</p>
  {serviceId ? (
    <ServiceBranchesTab serviceId={serviceId} serviceBranches={serviceBranches} />
  ) : (
    <ServiceBranchesPicker
      value={branchIds ?? []}
      onChange={(ids) => form.setValue("branchIds", ids)}
    />
  )}
</div>
```

- [ ] **Step 4: Typecheck**

```bash
cd dashboard && npm run typecheck
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add dashboard/components/features/services/create/basic-info-tab.tsx
git commit -m "feat(dashboard/services): wire ServiceBranchesPicker into create form"
```

---

## Task 6: Frontend — Pass `branchIds` in the create submit payload

The submit payload is built in two files:
- `dashboard/components/features/services/service-form-helpers.ts` — `buildPayload()` builds the core payload from `CreateServiceFormData`
- `dashboard/components/features/services/service-form-page.tsx` line 159 — calls `createMut.mutateAsync({ ...buildPayload(data), employeeIds: ... })`

`branchIds` should be added to `buildPayload()` so it's included automatically.

**Files:**
- Modify: `dashboard/components/features/services/service-form-helpers.ts`

- [ ] **Step 1: Add `branchIds` to `buildPayload`**

In `service-form-helpers.ts`, inside the `buildPayload` return object, add after `maxAdvanceDays`:

```ts
    branchIds: data.branchIds?.length ? data.branchIds : undefined,
```

The full return object becomes:

```ts
export function buildPayload(data: CreateServiceFormData) {
  return {
    nameEn: data.nameEn,
    nameAr: data.nameAr,
    descriptionEn: data.descriptionEn || undefined,
    descriptionAr: data.descriptionAr || undefined,
    categoryId: data.categoryId || undefined,
    isActive: data.isActive,
    isHidden: data.isHidden,
    hidePriceOnBooking: data.hidePriceOnBooking,
    hideDurationOnBooking: data.hideDurationOnBooking,
    iconName: data.iconName ?? null,
    iconBgColor: data.iconBgColor ?? null,
    imageUrl: data.imageUrl?.startsWith("blob:") ? undefined : (data.imageUrl ?? null),
    bufferMinutes: data.bufferMinutes,
    depositEnabled: data.depositEnabled,
    depositPercent: data.depositPercent,
    allowRecurring: data.allowRecurring,
    allowedRecurringPatterns: data.allowedRecurringPatterns,
    maxRecurrences: data.maxRecurrences,
    maxParticipants: data.maxParticipants,
    minLeadMinutes: data.minLeadMinutes,
    maxAdvanceDays: data.maxAdvanceDays,
    branchIds: data.branchIds?.length ? data.branchIds : undefined,
  }
}
```

Note: `undefined` = no restriction = available in all branches. On update (`isEdit`), `buildPayload` is also called but the backend `UpdateServiceDto` doesn't have `branchIds` — this is fine because `UpdateServicePayload` type doesn't include it and TypeScript will allow the extra field to be silently ignored, OR you can guard it. To be safe, only pass `branchIds` when not in edit mode. Move the field out of `buildPayload` and keep it inline in `service-form-page.tsx` instead:

**Alternative (safer) approach — keep `buildPayload` unchanged, add inline in `service-form-page.tsx` line 159:**

```ts
const created = await createMut.mutateAsync({
  ...buildPayload(data),
  employeeIds: pendingEmployeeIds.length > 0 ? pendingEmployeeIds : undefined,
  branchIds: data.branchIds?.length ? data.branchIds : undefined,
})
```

Use this approach. Do NOT add `branchIds` to `buildPayload`.

**Files:**
- Modify: `dashboard/components/features/services/service-form-page.tsx` (line ~159)

- [ ] **Step 2: Typecheck + lint**

```bash
cd dashboard && npm run typecheck && npm run lint
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add dashboard/components/features/services/service-form-page.tsx
git commit -m "feat(dashboard/services): pass branchIds in create service payload"
```

---

## Task 7: Verify end-to-end

- [ ] **Step 1: Start the stack**

```bash
npm run docker:up
npm run dev:backend &
npm run dev:dashboard &
```

- [ ] **Step 2: Manual test — all branches (default)**

1. Open dashboard → Services → Create new service
2. Fill required fields, leave branch picker on "جميع الفروع"
3. Save — service created
4. Open service → Basic Info tab → verify branch picker shows "جميع الفروع" (no restrictions)

- [ ] **Step 3: Manual test — specific branches**

1. Create a new service
2. Select "فروع محددة" and check one branch
3. Save — service created
4. Open service → Basic Info tab → verify the selected branch is checked

- [ ] **Step 4: Run backend tests**

```bash
cd backend && npm run test
```

Expected: all pass.

- [ ] **Step 5: Run frontend typecheck + lint**

```bash
cd dashboard && npm run typecheck && npm run lint
```

Expected: no errors.
