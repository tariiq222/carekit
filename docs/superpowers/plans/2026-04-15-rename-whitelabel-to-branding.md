# Rename: whitelabel / theme → branding — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify every reference to the visual-identity feature under the single name `branding` across packages, dashboard, mobile, and docs — matching the backend which already uses this name. Fix the broken `/whitelabel/public` endpoint in `api-client`.

**Architecture:** Single atomic rename delivered as many small commits on branch `feature/rename-branding`, then squash-merged to `main` as one commit. No backend module, schema, or endpoint changes (already correct). Defensive Prisma migration handles any production `Permission` rows with `subject='whitelabel'`.

**Tech Stack:** TypeScript strict, Next.js 15 dashboard, Expo mobile, `@carekit/shared`, `@carekit/api-client`, NestJS backend, Prisma, TanStack Query v5, next-intl, Vitest, Playwright.

**Spec:** [`docs/superpowers/specs/2026-04-15-rename-whitelabel-to-branding-design.md`](../specs/2026-04-15-rename-whitelabel-to-branding-design.md)

---

## File Structure

### Created
- `packages/shared/types/branding.ts` (replaces `types/theme.ts`)
- `packages/api-client/src/modules/branding.ts` (replaces `modules/theme.ts` + `modules/whitelabel.ts`)
- `packages/api-client/src/types/branding.ts` (replaces `types/whitelabel.ts`)
- `apps/backend/prisma/migrations/<timestamp>_rename_whitelabel_permission_to_branding/migration.sql`
- `apps/dashboard/app/(dashboard)/branding/page.tsx` (replaces `white-label/page.tsx`)
- `apps/dashboard/components/features/branding/branding-form.tsx` (replaces `features/white-label/branding-tab.tsx`)
- `apps/dashboard/hooks/use-branding.ts` (replaces `hooks/use-whitelabel.ts`)
- `apps/dashboard/lib/api/branding.ts` (replaces `lib/api/whitelabel.ts`)
- `apps/dashboard/lib/types/branding.ts` (replaces `lib/types/whitelabel.ts`)
- `apps/dashboard/lib/translations/ar.branding.ts` + `en.branding.ts` (replaces `ar.whitelabel.ts` + `en.whitelabel.ts`)
- `apps/dashboard/test/unit/hooks/use-branding.spec.tsx` (replaces `use-whitelabel.spec.tsx`)
- `apps/dashboard/test/unit/lib/branding-api.spec.ts` (replaces `whitelabel-api.spec.ts`)
- `apps/dashboard/test/e2e/settings/branding.e2e-spec.ts` + `branding-interactions.e2e-spec.ts`

### Modified
- `packages/shared/types/index.ts` — export path
- `packages/shared/enums/index.ts` (if contains WHITELABEL)
- `packages/shared/tokens/index.ts` (if contains whitelabel)
- `packages/shared/constants/modules.ts` (if contains whitelabel)
- `packages/api-client/src/index.ts`
- `packages/api-client/src/types/index.ts`
- `apps/dashboard/lib/query-keys.ts` (lines 204-208)
- `apps/dashboard/components/sidebar-config.ts` (line 64)
- `apps/dashboard/eslint.config.mjs` (FEATURES array line 32)
- `apps/dashboard/lib/translations/ar.ts` (lines 19, 34)
- `apps/dashboard/lib/translations/en.ts` (lines 19, 34)
- `apps/dashboard/lib/utils.ts` (any whitelabel refs)
- `apps/dashboard/tokens.md`
- `apps/dashboard/README.md`
- `apps/dashboard/CLAUDE.md`
- `apps/dashboard/CODEOWNERS`
- `apps/dashboard/test/unit/lib/query-keys.spec.ts`
- `apps/mobile/theme/ThemeProvider.tsx`
- `CLAUDE.md` (root)

### Deleted
- `packages/shared/types/theme.ts`
- `packages/api-client/src/modules/theme.ts`
- `packages/api-client/src/modules/whitelabel.ts`
- `packages/api-client/src/types/whitelabel.ts`
- `apps/dashboard/app/(dashboard)/white-label/` (entire directory)
- `apps/dashboard/components/features/white-label/` (entire directory)
- `apps/dashboard/hooks/use-whitelabel.ts`
- `apps/dashboard/lib/api/whitelabel.ts`
- `apps/dashboard/lib/types/whitelabel.ts`
- `apps/dashboard/lib/translations/ar.whitelabel.ts` + `en.whitelabel.ts`
- `apps/dashboard/test/unit/hooks/use-whitelabel.spec.tsx`
- `apps/dashboard/test/unit/lib/whitelabel-api.spec.ts`
- `apps/dashboard/test/e2e/settings/whitelabel.e2e-spec.ts` + `whitelabel-interactions.e2e-spec.ts`

---

## Task 0: Create branch and discovery

**Files:** none

- [ ] **Step 1: Create the feature branch**

```bash
cd c:/pro/carekit
git checkout -b feature/rename-branding
```

- [ ] **Step 2: Discovery — confirm CASL reads from DB, not JWT**

Search for how `CaslGuard` loads permissions.

Run:
```bash
grep -rn "permissions" apps/backend/src/common/guards/ 2>/dev/null
grep -rn "CaslGuard\|casl.guard" apps/backend/src/common/ 2>/dev/null
```

Open each match and read how permissions are gathered per request. Expected: the guard queries the DB (Prisma) using the request user's role/tenant each call. If instead permissions are taken from the decoded JWT payload, document this in a new heading in the spec: "After deploy, users must log out and back in for renamed permission to take effect."

- [ ] **Step 3: Commit discovery note if needed**

If discovery updated the spec:
```bash
git add docs/superpowers/specs/2026-04-15-rename-whitelabel-to-branding-design.md
git commit -m "docs: note JWT/DB permission behavior in branding rename spec"
```

Otherwise skip.

---

## Task 1: Rename shared types (theme.ts → branding.ts)

**Files:**
- Create: `packages/shared/types/branding.ts`
- Modify: `packages/shared/types/index.ts`
- Delete: `packages/shared/types/theme.ts`

- [ ] **Step 1: Create the new file with renamed identifiers**

Create `packages/shared/types/branding.ts` with this content:

```ts
/**
 * BrandingConfig — the canonical shape returned by GET /public/branding/:tenantId.
 * All apps (dashboard, mobile) consume this type.
 */
export interface BrandingConfig {
  // Identity
  systemName:        string;
  systemNameAr:      string;
  productTagline:    string | null;
  // Assets
  logoUrl:           string | null;
  faviconUrl:        string | null;
  // Colors
  colorPrimary:      string;
  colorPrimaryLight: string;
  colorPrimaryDark:  string;
  colorAccent:       string;
  colorAccentDark:   string;
  colorBackground:   string;
  // Typography
  fontFamily:        string;
  fontUrl:           string | null;
}

export interface DerivedTokens {
  colorPrimaryGlow:  string;
  colorPrimaryUltra: string;
  colorAccentGlow:   string;
  colorAccentUltra:  string;
}

export const DEFAULT_BRANDING: BrandingConfig = {
  systemName:        'CareKit',
  systemNameAr:      'كيركيت',
  productTagline:    'إدارة العيادة',
  logoUrl:           null,
  faviconUrl:        null,
  colorPrimary:      '#354FD8',
  colorPrimaryLight: '#5B72E8',
  colorPrimaryDark:  '#2438B0',
  colorAccent:       '#82CC17',
  colorAccentDark:   '#5A9010',
  colorBackground:   '#EEF1F8',
  fontFamily:        'IBM Plex Sans Arabic',
  fontUrl:           'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@300;400;500;600;700;800&display=swap',
};
```

- [ ] **Step 2: Update `packages/shared/types/index.ts` export**

Change line 9 from:
```ts
export * from './theme';
```
to:
```ts
export * from './branding';
```

- [ ] **Step 3: Delete the old theme file**

```bash
rm packages/shared/types/theme.ts
```

- [ ] **Step 4: Check other shared folders for whitelabel references**

Run:
```bash
grep -rn "whitelabel\|WhiteLabel\|Whitelabel\|WHITELABEL" packages/shared/
```

For each hit in `packages/shared/enums/index.ts`, `packages/shared/tokens/index.ts`, or `packages/shared/constants/modules.ts`, rename the identifier to the `branding` equivalent. Leave no references behind.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/
git commit -m "refactor(shared): rename theme → branding types"
```

Note: `packages/shared` may not build on its own yet because consumers still import the old names. That's expected — we fix them in later tasks.

---

## Task 2: Rename api-client (merge theme + whitelabel → branding, fix endpoint)

**Files:**
- Create: `packages/api-client/src/modules/branding.ts`
- Create: `packages/api-client/src/types/branding.ts`
- Modify: `packages/api-client/src/index.ts`
- Modify: `packages/api-client/src/types/index.ts`
- Delete: `packages/api-client/src/modules/theme.ts`
- Delete: `packages/api-client/src/modules/whitelabel.ts`
- Delete: `packages/api-client/src/types/whitelabel.ts`

- [ ] **Step 1: Inspect existing types file to preserve any extra types**

Run:
```bash
cat packages/api-client/src/types/whitelabel.ts
```

Copy any types defined here (beyond a re-export of `OrganizationTheme`) to be included in the new `branding.ts`.

- [ ] **Step 2: Create `packages/api-client/src/types/branding.ts`**

Write the file, preserving all exports found in the old file but renamed. If the old file was just:
```ts
export type { OrganizationTheme as WhitelabelConfig } from '@carekit/shared/types'
```
then the new file is:
```ts
export type { BrandingConfig } from '@carekit/shared/types'
```

If the old file contained additional interfaces (e.g., `UpdateWhitelabelPayload`), port them as `UpdateBrandingPayload`:
```ts
export type { BrandingConfig } from '@carekit/shared/types'

export type UpdateBrandingPayload = Partial<Omit<BrandingConfig, 'id' | 'createdAt' | 'updatedAt'>>
```

- [ ] **Step 3: Create `packages/api-client/src/modules/branding.ts`**

```ts
import { apiRequest } from '../client.js'
import type { BrandingConfig } from '@carekit/shared/types'

/**
 * Fetches public branding for a tenant from the unified branding endpoint.
 * Used by mobile app on startup and dashboard pre-auth.
 */
export async function getBrandingPublic(tenantId: string): Promise<BrandingConfig> {
  return apiRequest<BrandingConfig>(`/public/branding/${tenantId}`)
}
```

Note the fix: endpoint is now the real backend URL, and `tenantId` is a required parameter.

- [ ] **Step 4: Update `packages/api-client/src/index.ts`**

Remove these lines:
```ts
export * as whitelabelApi from './modules/whitelabel.js'
export * as themeApi from './modules/theme.js'
```

Add this line in their place (keep alphabetical-ish position — next to other alphabetically-close modules):
```ts
export * as brandingApi from './modules/branding.js'
```

- [ ] **Step 5: Update `packages/api-client/src/types/index.ts`**

Run:
```bash
cat packages/api-client/src/types/index.ts
```

Replace any `export * from './whitelabel'` with `export * from './branding'`. Remove duplicates.

- [ ] **Step 6: Delete old files**

```bash
rm packages/api-client/src/modules/theme.ts
rm packages/api-client/src/modules/whitelabel.ts
rm packages/api-client/src/types/whitelabel.ts
```

- [ ] **Step 7: Verify no remaining whitelabel/theme refs in api-client**

```bash
grep -rn "whitelabel\|WhiteLabel\|Whitelabel\|theme" packages/api-client/src/ | grep -v node_modules
```

Expected: only matches are `branding`-related or unrelated (e.g., `theme` in unrelated feature-flags). Zero `whitelabel` hits.

- [ ] **Step 8: Build api-client**

```bash
cd packages/api-client && npm run build 2>&1 | tail -20
```

Expected: clean build, no errors.

- [ ] **Step 9: Commit**

```bash
cd c:/pro/carekit
git add packages/api-client/
git commit -m "refactor(api-client): merge theme+whitelabel into branding, fix endpoint to /public/branding/:tenantId"
```

---

## Task 3: Backend defensive Prisma migration

**Files:**
- Create: `apps/backend/prisma/migrations/<timestamp>_rename_whitelabel_permission_to_branding/migration.sql`

- [ ] **Step 1: Generate an empty migration scaffold**

```bash
cd apps/backend
npx prisma migrate dev --create-only --name rename_whitelabel_permission_to_branding
```

This creates an empty migration folder. Open the generated SQL file.

- [ ] **Step 2: Write the defensive UPDATE**

Replace the empty migration content with:

```sql
-- Defensive rename: any Permission rows with subject='whitelabel' become subject='branding'.
-- No-op if no rows exist (seed does not create any).
UPDATE "Permission"
SET "subject" = 'branding'
WHERE "subject" = 'whitelabel';
```

- [ ] **Step 3: Apply migration locally**

```bash
cd apps/backend && npm run prisma:migrate
```

Expected: "Database is now in sync with the schema" — the migration runs as a no-op on a clean dev DB.

- [ ] **Step 4: Smoke-test with a seeded row**

Open Prisma Studio (`npm run prisma:studio`) or run via `psql`:
```sql
-- Insert a test row
INSERT INTO "Permission" (id, action, subject, "tenantId", "customRoleId", "createdAt", "updatedAt")
VALUES (gen_random_uuid(), 'edit', 'whitelabel', <some-tenant-id>, <some-role-id>, NOW(), NOW());

-- Re-run the migration manually to verify idempotency
-- (in practice you can just re-apply via: npx prisma migrate resolve --applied <name>)

-- Verify the row now has subject='branding'
SELECT subject FROM "Permission" WHERE action='edit' ORDER BY "updatedAt" DESC LIMIT 1;
```

Expected: `subject='branding'`. Clean up the test row.

- [ ] **Step 5: Commit**

```bash
cd c:/pro/carekit
git add apps/backend/prisma/migrations/
git commit -m "feat(backend): defensive migration to rename Permission subject whitelabel→branding"
```

---

## Task 4: Dashboard — rename types and API layer

**Files:**
- Create: `apps/dashboard/lib/types/branding.ts`
- Create: `apps/dashboard/lib/api/branding.ts`
- Delete: `apps/dashboard/lib/types/whitelabel.ts`
- Delete: `apps/dashboard/lib/api/whitelabel.ts`

- [ ] **Step 1: Create `apps/dashboard/lib/types/branding.ts`**

```ts
/**
 * Branding Types — CareKit Dashboard
 */

export interface BrandingConfig {
  id: string
  // Identity
  systemName:        string
  systemNameAr:      string
  productTagline:    string | null
  // Assets
  logoUrl:           string | null
  faviconUrl:        string | null
  // Colors
  colorPrimary:      string
  colorPrimaryLight: string
  colorPrimaryDark:  string
  colorAccent:       string
  colorAccentDark:   string
  colorBackground:   string
  // Typography
  fontFamily:        string
  fontUrl:           string | null
  // SaaS config
  domain:            string
  clinicCanEdit:     boolean
  createdAt:         string
  updatedAt:         string
}

export type PublicBranding = Omit<BrandingConfig, "id" | "domain" | "clinicCanEdit" | "createdAt" | "updatedAt">

export type UpdateBrandingPayload = Partial<Omit<BrandingConfig, "id" | "createdAt" | "updatedAt">>
```

- [ ] **Step 2: Create `apps/dashboard/lib/api/branding.ts`**

```ts
/**
 * Branding API — CareKit Dashboard
 */

import { api } from "@/lib/api"
import type { BrandingConfig, UpdateBrandingPayload, PublicBranding } from "@/lib/types/branding"

/* ─── Queries ─── */

export async function fetchBranding(): Promise<BrandingConfig> {
  return api.get<BrandingConfig>("/dashboard/organization/branding")
}

export async function fetchPublicBranding(): Promise<PublicBranding> {
  return api.get<PublicBranding>("/public/branding")
}

/* ─── Mutations ─── */

export async function updateBranding(
  data: UpdateBrandingPayload,
): Promise<BrandingConfig> {
  return api.post<BrandingConfig>("/dashboard/organization/branding", data)
}
```

- [ ] **Step 3: Delete old files**

```bash
rm apps/dashboard/lib/types/whitelabel.ts
rm apps/dashboard/lib/api/whitelabel.ts
```

- [ ] **Step 4: Commit**

```bash
git add apps/dashboard/lib/
git commit -m "refactor(dashboard): rename whitelabel → branding in lib/types + lib/api"
```

---

## Task 5: Dashboard — rename hook and query keys

**Files:**
- Create: `apps/dashboard/hooks/use-branding.ts`
- Modify: `apps/dashboard/lib/query-keys.ts` (lines 204-208)
- Delete: `apps/dashboard/hooks/use-whitelabel.ts`

- [ ] **Step 1: Modify `apps/dashboard/lib/query-keys.ts`**

Locate the WhiteLabel block (lines 204-208):

```ts
  /* ─── WhiteLabel ─── */
  whitelabel: {
    all: ["whitelabel"] as const,
    config: () => ["whitelabel", "config"] as const,
  },
```

Replace with:

```ts
  /* ─── Branding ─── */
  branding: {
    all: ["branding"] as const,
    config: () => ["branding", "config"] as const,
  },
```

- [ ] **Step 2: Create `apps/dashboard/hooks/use-branding.ts`**

```ts
"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { fetchBranding, updateBranding } from "@/lib/api/branding"
import type { UpdateBrandingPayload } from "@/lib/types/branding"

export function useBranding() {
  return useQuery({
    queryKey: queryKeys.branding.config(),
    queryFn: fetchBranding,
    staleTime: 10 * 60 * 1000,
  })
}

export function useUpdateBranding() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: UpdateBrandingPayload) => updateBranding(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.branding.all })
    },
  })
}
```

- [ ] **Step 3: Delete the old hook**

```bash
rm apps/dashboard/hooks/use-whitelabel.ts
```

- [ ] **Step 4: Commit**

```bash
git add apps/dashboard/hooks/ apps/dashboard/lib/query-keys.ts
git commit -m "refactor(dashboard): rename useWhitelabel → useBranding + query keys"
```

---

## Task 6: Dashboard — rename translations

**Files:**
- Create: `apps/dashboard/lib/translations/ar.branding.ts`
- Create: `apps/dashboard/lib/translations/en.branding.ts`
- Modify: `apps/dashboard/lib/translations/ar.ts` (lines 19, 34)
- Modify: `apps/dashboard/lib/translations/en.ts` (lines 19, 34)
- Delete: `apps/dashboard/lib/translations/ar.whitelabel.ts`
- Delete: `apps/dashboard/lib/translations/en.whitelabel.ts`

- [ ] **Step 1: Copy and rename Arabic translation file**

```bash
cp apps/dashboard/lib/translations/ar.whitelabel.ts apps/dashboard/lib/translations/ar.branding.ts
```

- [ ] **Step 2: Rewrite the new file header and all keys**

Open `apps/dashboard/lib/translations/ar.branding.ts`. Replace:

- Header comment `White Label / System Setup module` → `Branding module`
- Export name `arWhiteLabel` → `arBranding`
- **Every key prefix** `whiteLabel.` → `branding.`

Use editor find-and-replace: find `whiteLabel.` (note the dot) and replace with `branding.`. Then find `arWhiteLabel` and replace with `arBranding`.

Verify no `whiteLabel` remains:
```bash
grep -n "whiteLabel\|WhiteLabel\|whitelabel" apps/dashboard/lib/translations/ar.branding.ts
```
Expected: zero matches.

- [ ] **Step 3: Repeat for English**

```bash
cp apps/dashboard/lib/translations/en.whitelabel.ts apps/dashboard/lib/translations/en.branding.ts
```

Open `en.branding.ts`. Apply the same substitutions:
- `enWhiteLabel` → `enBranding`
- `whiteLabel.` → `branding.`
- Header comment update

Verify:
```bash
grep -n "whiteLabel\|WhiteLabel\|whitelabel" apps/dashboard/lib/translations/en.branding.ts
```
Expected: zero matches.

- [ ] **Step 4: Update `apps/dashboard/lib/translations/ar.ts`**

Change line 19 from:
```ts
import { arWhiteLabel } from "./ar.whitelabel"
```
to:
```ts
import { arBranding } from "./ar.branding"
```

Change line 34 from:
```ts
  ...arWhiteLabel,
```
to:
```ts
  ...arBranding,
```

- [ ] **Step 5: Update `apps/dashboard/lib/translations/en.ts`**

Change line 19 from:
```ts
import { enWhiteLabel } from "./en.whitelabel"
```
to:
```ts
import { enBranding } from "./en.branding"
```

Change line 34 from:
```ts
  ...enWhiteLabel,
```
to:
```ts
  ...enBranding,
```

- [ ] **Step 6: Delete old translation files**

```bash
rm apps/dashboard/lib/translations/ar.whitelabel.ts
rm apps/dashboard/lib/translations/en.whitelabel.ts
```

- [ ] **Step 7: Update nav translation keys**

Run:
```bash
grep -n "nav.whiteLabel\|whiteLabel" apps/dashboard/lib/translations/ar.nav.ts apps/dashboard/lib/translations/en.nav.ts
```

For each match, rename `nav.whiteLabel` → `nav.branding`. Commit the key rename in both `ar.nav.ts` and `en.nav.ts`.

- [ ] **Step 8: Commit**

```bash
git add apps/dashboard/lib/translations/
git commit -m "refactor(dashboard): rename whiteLabel i18n namespace → branding"
```

---

## Task 7: Dashboard — rename feature component

**Files:**
- Create: `apps/dashboard/components/features/branding/branding-form.tsx`
- Delete: `apps/dashboard/components/features/white-label/branding-tab.tsx`
- Delete: `apps/dashboard/components/features/white-label/` (empty dir)

- [ ] **Step 1: Create the new component directory**

```bash
mkdir -p apps/dashboard/components/features/branding
```

- [ ] **Step 2: Move the file and rename**

```bash
git mv apps/dashboard/components/features/white-label/branding-tab.tsx apps/dashboard/components/features/branding/branding-form.tsx
```

- [ ] **Step 3: Update the component internals**

Open `apps/dashboard/components/features/branding/branding-form.tsx` and:

- Rename the exported function `BrandingTab` → `BrandingForm`
- Update type imports: `WhiteLabelConfig` → `BrandingConfig`, `UpdateWhitelabelPayload` → `UpdateBrandingPayload`
- Update import paths: `@/lib/types/whitelabel` → `@/lib/types/branding`

Verify:
```bash
grep -n "WhiteLabel\|whitelabel\|BrandingTab" apps/dashboard/components/features/branding/branding-form.tsx
```
Expected: zero matches.

- [ ] **Step 4: Remove empty old directory**

```bash
rmdir apps/dashboard/components/features/white-label 2>/dev/null || true
```

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/components/
git commit -m "refactor(dashboard): rename BrandingTab → BrandingForm under features/branding/"
```

---

## Task 8: Dashboard — rename route and page

**Files:**
- Create: `apps/dashboard/app/(dashboard)/branding/page.tsx`
- Delete: `apps/dashboard/app/(dashboard)/white-label/page.tsx`
- Delete: `apps/dashboard/app/(dashboard)/white-label/` (empty dir)

- [ ] **Step 1: Move the page**

```bash
mkdir -p apps/dashboard/app/\(dashboard\)/branding
git mv apps/dashboard/app/\(dashboard\)/white-label/page.tsx apps/dashboard/app/\(dashboard\)/branding/page.tsx
```

- [ ] **Step 2: Update the page contents**

Open `apps/dashboard/app/(dashboard)/branding/page.tsx`. Replace the entire file with:

```tsx
"use client"

import { toast } from "sonner"
import { ListPageShell } from "@/components/features/list-page-shell"
import { PageHeader } from "@/components/features/page-header"
import { Skeleton } from "@/components/ui/skeleton"
import { Breadcrumbs } from "@/components/features/breadcrumbs"
import { useLocale } from "@/components/locale-provider"
import { useBranding, useUpdateBranding } from "@/hooks/use-branding"
import { useAuth } from "@/components/providers/auth-provider"

import { BrandingForm } from "@/components/features/branding/branding-form"
import type { UpdateBrandingPayload } from "@/lib/types/branding"

export default function BrandingPage() {
  const { t } = useLocale()
  const { canDo } = useAuth()
  const { data: branding, isLoading } = useBranding()
  const mutation = useUpdateBranding()

  if (!canDo("branding", "edit")) {
    return (
      <ListPageShell>
        <Breadcrumbs />
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-lg font-medium text-muted-foreground">{t("common.noPermission") ?? "ليس لديك صلاحية للوصول لهذه الصفحة"}</p>
        </div>
      </ListPageShell>
    )
  }

  const handleSave = (data: UpdateBrandingPayload) => {
    mutation.mutate(data, {
      onSuccess: () => toast.success(t("settings.saved")),
      onError: () => toast.error(t("settings.error")),
    })
  }

  if (isLoading) {
    return (
      <ListPageShell>
        <Breadcrumbs />
        <PageHeader title={t("branding.title")} description={t("branding.description")} />
        <div className="space-y-4">
          <Skeleton className="h-10 w-full sm:w-96" />
          <Skeleton className="h-[300px] rounded-lg" />
        </div>
      </ListPageShell>
    )
  }

  return (
    <ListPageShell>
      <Breadcrumbs />
      <PageHeader title={t("branding.title")} description={t("branding.description")} />

      <BrandingForm
        branding={branding ?? null}
        onSave={handleSave}
        isPending={mutation.isPending}
      />
    </ListPageShell>
  )
}
```

Notes:
- `useWhitelabel` → `useBranding`
- `useUpdateWhitelabel` → `useUpdateBranding`
- `canDo("whitelabel", "edit")` → `canDo("branding", "edit")`
- `t("whiteLabel.title")` → `t("branding.title")`
- `t("whiteLabel.description")` → `t("branding.description")`
- Prop `whitelabel={whitelabel ?? null}` → `branding={branding ?? null}` (this requires updating `BrandingForm` props — do that next)

- [ ] **Step 3: Update `BrandingForm` prop name**

Open `apps/dashboard/components/features/branding/branding-form.tsx`. Find the `Props` interface and rename the prop `whitelabel` → `branding` (both in the interface and in the destructuring inside the function body). Search for all internal references to the old prop name and update them.

Verify:
```bash
grep -n "whitelabel\|whiteLabel" apps/dashboard/components/features/branding/branding-form.tsx
```
Expected: zero matches.

- [ ] **Step 4: Remove empty old route directory**

```bash
rmdir apps/dashboard/app/\(dashboard\)/white-label 2>/dev/null || true
```

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/app/ apps/dashboard/components/
git commit -m "refactor(dashboard): rename /white-label route → /branding + page rewire"
```

---

## Task 9: Dashboard — sidebar, eslint, CASL refs

**Files:**
- Modify: `apps/dashboard/components/sidebar-config.ts` (line 64)
- Modify: `apps/dashboard/eslint.config.mjs` (line 32)

- [ ] **Step 1: Update sidebar**

Open `apps/dashboard/components/sidebar-config.ts`. On line 64, change:

```ts
  { titleKey: "nav.whiteLabel", href: "/white-label", icon: PaintBrush01Icon, permission: "whitelabel:edit" },
```

to:

```ts
  { titleKey: "nav.branding", href: "/branding", icon: PaintBrush01Icon, permission: "branding:edit" },
```

- [ ] **Step 2: Update eslint FEATURES array**

Open `apps/dashboard/eslint.config.mjs`. On line 32, change:

```js
  "white-label",
```

to:

```js
  "branding",
```

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/components/sidebar-config.ts apps/dashboard/eslint.config.mjs
git commit -m "refactor(dashboard): update sidebar + eslint for branding rename"
```

---

## Task 10: Dashboard — rename unit tests

**Files:**
- Create: `apps/dashboard/test/unit/hooks/use-branding.spec.tsx`
- Create: `apps/dashboard/test/unit/lib/branding-api.spec.ts`
- Modify: `apps/dashboard/test/unit/lib/query-keys.spec.ts`
- Delete: `apps/dashboard/test/unit/hooks/use-whitelabel.spec.tsx`
- Delete: `apps/dashboard/test/unit/lib/whitelabel-api.spec.ts`

- [ ] **Step 1: Move and update the hook spec**

```bash
git mv apps/dashboard/test/unit/hooks/use-whitelabel.spec.tsx apps/dashboard/test/unit/hooks/use-branding.spec.tsx
```

Open the file and apply:
- All import paths: `use-whitelabel` → `use-branding`, `/lib/api/whitelabel` → `/lib/api/branding`, `/lib/types/whitelabel` → `/lib/types/branding`
- All identifier references: `useWhitelabel` → `useBranding`, `useUpdateWhitelabel` → `useUpdateBranding`, `WhiteLabelConfig` → `BrandingConfig`, `UpdateWhitelabelPayload` → `UpdateBrandingPayload`, `fetchWhitelabel` → `fetchBranding`, `updateWhitelabel` → `updateBranding`
- All `describe()` / `it()` names mentioning whitelabel → branding
- Query key assertions: `["whitelabel", "config"]` → `["branding", "config"]`

Verify:
```bash
grep -n "whitelabel\|WhiteLabel\|whiteLabel" apps/dashboard/test/unit/hooks/use-branding.spec.tsx
```
Expected: zero matches.

- [ ] **Step 2: Move and update the API spec**

```bash
git mv apps/dashboard/test/unit/lib/whitelabel-api.spec.ts apps/dashboard/test/unit/lib/branding-api.spec.ts
```

Apply the same substitutions to this file. Verify:
```bash
grep -n "whitelabel\|WhiteLabel\|whiteLabel" apps/dashboard/test/unit/lib/branding-api.spec.ts
```
Expected: zero matches.

- [ ] **Step 3: Update query-keys.spec.ts**

Open `apps/dashboard/test/unit/lib/query-keys.spec.ts`. Locate any test referencing `queryKeys.whitelabel` and rename to `queryKeys.branding`. Any hardcoded assertion `["whitelabel", "config"]` → `["branding", "config"]`.

Verify:
```bash
grep -n "whitelabel" apps/dashboard/test/unit/lib/query-keys.spec.ts
```
Expected: zero matches.

- [ ] **Step 4: Run unit tests**

```bash
cd apps/dashboard && npm run test -- --run 2>&1 | tail -40
```

Expected: all tests pass. If a test references an old translation key, update it.

- [ ] **Step 5: Commit**

```bash
cd c:/pro/carekit
git add apps/dashboard/test/unit/
git commit -m "test(dashboard): rename whitelabel → branding unit specs"
```

---

## Task 11: Dashboard — rename e2e tests

**Files:**
- Create: `apps/dashboard/test/e2e/settings/branding.e2e-spec.ts`
- Create: `apps/dashboard/test/e2e/settings/branding-interactions.e2e-spec.ts`
- Delete: `apps/dashboard/test/e2e/settings/whitelabel.e2e-spec.ts`
- Delete: `apps/dashboard/test/e2e/settings/whitelabel-interactions.e2e-spec.ts`

- [ ] **Step 1: Move the primary e2e spec**

```bash
git mv apps/dashboard/test/e2e/settings/whitelabel.e2e-spec.ts apps/dashboard/test/e2e/settings/branding.e2e-spec.ts
```

Apply substitutions to the moved file:
- Route paths: `/white-label` → `/branding`
- Describe blocks, test names: whitelabel → branding
- Any selector for `[data-testid=...]` using whitelabel — update accordingly

- [ ] **Step 2: Move the interactions spec**

```bash
git mv apps/dashboard/test/e2e/settings/whitelabel-interactions.e2e-spec.ts apps/dashboard/test/e2e/settings/branding-interactions.e2e-spec.ts
```

Apply the same substitutions.

- [ ] **Step 3: Verify**

```bash
grep -rn "whitelabel\|white-label\|WhiteLabel" apps/dashboard/test/e2e/
```
Expected: zero matches.

- [ ] **Step 4: Run e2e tests (optional but recommended)**

```bash
cd apps/dashboard && npm run test:e2e 2>&1 | tail -30
```

Expected: pass. If the dashboard dev server isn't running, skip this and rely on the final CI check.

- [ ] **Step 5: Commit**

```bash
cd c:/pro/carekit
git add apps/dashboard/test/e2e/
git commit -m "test(dashboard): rename whitelabel → branding e2e specs"
```

---

## Task 12: Dashboard — stragglers (utils, tokens.md, README, CODEOWNERS)

**Files:**
- Modify: `apps/dashboard/lib/utils.ts` (if matches)
- Modify: `apps/dashboard/tokens.md`
- Modify: `apps/dashboard/README.md`
- Modify: `apps/dashboard/CODEOWNERS`

- [ ] **Step 1: Search all remaining matches**

```bash
grep -rn "whitelabel\|white-label\|WhiteLabel\|whiteLabel" apps/dashboard/ --include="*.ts" --include="*.tsx" --include="*.md" --include="CODEOWNERS"
```

- [ ] **Step 2: For each hit, apply the rename**

- `.ts`/`.tsx`: rename identifiers to `branding`/`Branding`.
- `.md`: rename mentions of the feature to `Branding` (capitalize for prose).
- `CODEOWNERS`: rename any `white-label/` path to `branding/`.

Files to verify (one-by-one):
- `apps/dashboard/lib/utils.ts`
- `apps/dashboard/tokens.md`
- `apps/dashboard/README.md`
- `apps/dashboard/CODEOWNERS`

- [ ] **Step 3: Final grep check for dashboard**

```bash
grep -rn "whitelabel\|white-label\|WhiteLabel\|whiteLabel" apps/dashboard/ | grep -v node_modules | grep -v ".next"
```

Expected: zero matches.

- [ ] **Step 4: Commit**

```bash
git add apps/dashboard/
git commit -m "refactor(dashboard): rename whitelabel → branding stragglers (utils, docs, CODEOWNERS)"
```

---

## Task 13: Mobile — update ThemeProvider

**Files:**
- Modify: `apps/mobile/theme/ThemeProvider.tsx`

- [ ] **Step 1: Read current imports**

```bash
grep -n "whitelabel\|OrganizationTheme\|DEFAULT_THEME\|getTheme\|themeApi" apps/mobile/theme/ThemeProvider.tsx
```

- [ ] **Step 2: Apply substitutions**

Open `apps/mobile/theme/ThemeProvider.tsx` and apply:
- Import from `@carekit/shared/types`: `OrganizationTheme` → `BrandingConfig`, `DEFAULT_THEME` → `DEFAULT_BRANDING`
- Import from `@carekit/api-client`: remove `themeApi` or `whitelabelApi`; replace with `brandingApi`
- Call site: `themeApi.getTheme()` → `brandingApi.getBrandingPublic(tenantId)`
- The mobile ThemeProvider must now obtain the `tenantId` (from env or bootstrap config) to pass through.

If `tenantId` isn't already available in the mobile bootstrap, read the nearby code to find its source. Commonly it's in an env constant like `expo-constants` extras or a hardcoded value in `app.config.ts`. If truly unavailable, pause this task and surface as a question — don't invent a source.

- [ ] **Step 3: Verify no leftover whitelabel/theme refs**

```bash
grep -n "whitelabel\|WhiteLabel\|OrganizationTheme\|DEFAULT_THEME\|getTheme" apps/mobile/theme/ThemeProvider.tsx
```
Expected: zero matches.

- [ ] **Step 4: Type-check the mobile app**

```bash
cd apps/mobile && npx tsc --noEmit 2>&1 | tail -20
```

Expected: clean. If errors surface from `@carekit/shared` resolution, the workspace package may need `npm install` or `npm run build --workspace=@carekit/shared` first.

- [ ] **Step 5: Commit**

```bash
cd c:/pro/carekit
git add apps/mobile/
git commit -m "refactor(mobile): use BrandingConfig + brandingApi.getBrandingPublic in ThemeProvider"
```

---

## Task 14: Root + backend + remaining docs

**Files:**
- Modify: `CLAUDE.md` (root)
- Modify: `apps/backend/CLAUDE.md` (if mentions whitelabel — check first)
- Any AGENTS.md at root or in apps

- [ ] **Step 1: Update root `CLAUDE.md`**

Open `c:/pro/carekit/CLAUDE.md`. Find the Key Domains table. Locate the row:

```
| Whitelabel | `whitelabel/` | `settings/` | Clinic branding config |
```

Replace with:

```
| Branding | `org-experience/branding/` | `branding/` | Clinic branding config |
```

Scan for any other mention of `whitelabel` / `WhiteLabel` in root `CLAUDE.md` and update.

- [ ] **Step 2: Check backend CLAUDE.md**

```bash
grep -n "whitelabel\|WhiteLabel\|white-label" apps/backend/CLAUDE.md
```

If matches exist, update them. If none, skip.

- [ ] **Step 3: Check AGENTS.md**

```bash
find . -maxdepth 3 -name "AGENTS.md" 2>/dev/null
```

If any file found, grep for whitelabel references and update them.

- [ ] **Step 4: Final monorepo grep**

```bash
grep -rn "whitelabel\|white-label\|WhiteLabel\|whiteLabel" apps/ packages/ docs/ *.md 2>/dev/null \
  | grep -v node_modules \
  | grep -v ".next" \
  | grep -v "docs/superpowers/specs/2026-04-11-whitelabel-settings-page-design.md" \
  | grep -v "docs/superpowers/specs/2026-04-15-rename-whitelabel-to-branding-design.md" \
  | grep -v "docs/superpowers/plans/2026-04-15-rename-whitelabel-to-branding.md"
```

Expected: zero matches. (The three exclusions are the historical spec and this task's own documents, which legitimately mention the old name.)

If any line surfaces, investigate and rename.

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md apps/
git commit -m "docs: update CLAUDE.md files for branding rename"
```

---

## Task 15: Final verification and squash-merge

**Files:** none (verification only)

- [ ] **Step 1: Full build**

```bash
cd c:/pro/carekit && npm run build 2>&1 | tail -40
```

Expected: every workspace builds clean. If a workspace fails, open the error, fix the file, re-commit in the owning task. Do not continue until clean.

- [ ] **Step 2: Typecheck dashboard**

```bash
cd apps/dashboard && npm run typecheck 2>&1 | tail -20
```

Expected: 0 errors.

- [ ] **Step 3: Lint dashboard**

```bash
cd apps/dashboard && npm run lint 2>&1 | tail -20
```

Expected: 0 errors.

- [ ] **Step 4: Run all unit tests**

```bash
cd c:/pro/carekit && npm run test 2>&1 | tail -40
```

Expected: all pass.

- [ ] **Step 5: Apply backend migration on dev DB**

```bash
cd apps/backend && npm run prisma:migrate
```

Expected: migration already applied in Task 3; re-run is a no-op.

- [ ] **Step 6: Smoke-test the dashboard manually**

```bash
cd c:/pro/carekit && npm run dev:dashboard
```

In browser, navigate to `http://localhost:5103/branding`. Confirm:
- Page loads with title from `branding.title` translation (AR or EN, based on locale)
- Sidebar entry "Branding" visible under Admin group with paintbrush icon
- Permission guard works: if the user lacks `branding:edit`, the "no permission" page shows
- Form submission updates the BrandingConfig (check network tab for POST `/dashboard/organization/branding`)
- After save, the public endpoint `/public/branding/:tenantId` reflects the change (reload page)

Also confirm:
- Navigating to old URL `http://localhost:5103/white-label` shows 404 (expected — route removed)

- [ ] **Step 7: Final repo-wide grep**

```bash
cd c:/pro/carekit
grep -rn "whitelabel\|white-label\|WhiteLabel\|whiteLabel" apps/ packages/ 2>/dev/null | grep -v node_modules | grep -v ".next"
```

Expected: zero matches in source code.

- [ ] **Step 8: Push the branch**

```bash
git push -u origin feature/rename-branding
```

- [ ] **Step 9: Squash-merge to main**

On GitHub, open a PR `feature/rename-branding` → `main`. Use **Squash and merge**. Commit message on `main`:

```
refactor: rename whitelabel/theme → branding across monorepo

Unifies naming for the visual-identity feature. Renames:
- packages/shared types (OrganizationTheme → BrandingConfig)
- packages/api-client modules (merges theme+whitelabel into branding,
  fixes broken /whitelabel/public endpoint to /public/branding/:tenantId)
- Dashboard route, component, hook, api, types, i18n, sidebar, CASL ref
- Mobile ThemeProvider imports
- Defensive Prisma migration: Permission subject 'whitelabel' → 'branding'
- Root + dashboard CLAUDE.md updates

No backend module, schema, or endpoint changes — those were already 'branding'.
```

- [ ] **Step 10: Post-merge verification**

```bash
git checkout main && git pull
cd apps/backend && npm run prisma:migrate   # apply migration on main
npm run build                                # full build on main
```

Expected: all pass.

- [ ] **Step 11: Delete the branch**

```bash
git branch -d feature/rename-branding
git push origin --delete feature/rename-branding
```

---

## Self-Review Checklist (For the Implementing Agent)

Before squash-merge, verify:

1. Every `whitelabel` / `WhiteLabel` / `white-label` / `whiteLabel` match in `apps/` and `packages/` is gone (Task 15 step 7).
2. The `/public/branding/:tenantId` endpoint is the one api-client calls (not the old `/whitelabel/public`).
3. Dashboard sidebar shows "Branding" not "White Label".
4. Permission string in sidebar is `branding:edit` not `whitelabel:edit`.
5. queryKey assertion in tests is `["branding", "config"]`.
6. Mobile app typechecks without `OrganizationTheme` or `DEFAULT_THEME`.
7. Root `CLAUDE.md` Key Domains table shows `Branding | org-experience/branding/ | branding/`.
8. Migration has been applied and smoke-tested.
9. Manual dashboard smoke test (Task 15 step 6) passes: page loads, permission guard works, submission persists.

If any of these fail, return to the relevant task, fix, commit, and re-verify before merging.
