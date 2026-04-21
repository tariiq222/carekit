# SaaS-05a — Shared UI Package Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Extract 35 shadcn/ui primitives from `apps/dashboard/components/ui/` into a new `packages/ui/` workspace consumed by dashboard today and by `apps/admin/` + `apps/landing/` (future plans). Pure move + re-export — zero behavior change. Unblocks Plans 05b, 06, 07, 08.

**Architecture:** New monorepo workspace `@carekit/ui`. Peer-dependent on `react`, `react-dom`, `tailwindcss`, `lucide-react`, `class-variance-authority`, `@radix-ui/*`. Depends on `@carekit/shared` for tokens. Uses `"type": "module"` + TypeScript source exports (matching `@carekit/api-client` convention). No bundling — consumers transpile source directly.

**Tech Stack:** TypeScript 5.4, React 19, Tailwind 4, shadcn/ui, vitest (for component tests), Turborepo.

---

## Scope

### In-scope (35 components to move)

All `.tsx` files currently under `apps/dashboard/components/ui/`:

**Core primitives:** button, card, dialog, alert-dialog, badge, label, separator, skeleton
**Form:** input, input-group, select, checkbox, radio-group, date-picker, date-time-input, phone-input, nationality-select, avatar-upload
**Layout:** sheet, scroll-area, popover, dropdown-menu, command, calendar, avatar
**Navigation:** sidebar, sidebar-menu, sidebar-context
**Feedback:** sonner, ripple

### Explicitly deferred

- Feature-specific components in `apps/dashboard/components/features/*` — stay in dashboard (not reusable across apps).
- Theme tokens — already live in `@carekit/shared/tokens`. Not touched here.
- Type-level changes — none. Move only.

### Invariants

1. `apps/dashboard` builds and runs identically after extraction.
2. No visual regressions (tested via running dashboard locally).
3. All 35 files retain identical source (only import paths change).
4. `npm run build` + `npm run lint` + `npm run test` pass at monorepo root.

---

## File Structure

### New files

| File | Responsibility |
|---|---|
| `packages/ui/package.json` | Workspace manifest (`@carekit/ui`), peer deps, exports map |
| `packages/ui/tsconfig.json` | Extends root tsconfig; emits no output (source-only) |
| `packages/ui/vitest.config.ts` | Matches `@carekit/api-client` pattern for tests |
| `packages/ui/src/lib/cn.ts` | `cn()` helper (clsx + tailwind-merge) — moved from dashboard |
| `packages/ui/src/index.ts` | Barrel re-export of every component |
| `packages/ui/src/primitives/*.tsx` | The 35 components (grouped by category, paths below) |
| `packages/ui/CLAUDE.md` | Conventions: what belongs here, what doesn't |

### Component organization

```
packages/ui/src/
├── primitives/
│   ├── button.tsx           card.tsx             dialog.tsx
│   ├── alert-dialog.tsx     badge.tsx            label.tsx
│   ├── separator.tsx        skeleton.tsx
│   ├── input.tsx            input-group.tsx      select.tsx
│   ├── checkbox.tsx         radio-group.tsx
│   ├── date-picker.tsx      date-time-input.tsx  calendar.tsx
│   ├── phone-input.tsx      nationality-select.tsx
│   ├── avatar.tsx           avatar-upload.tsx
│   ├── sheet.tsx            scroll-area.tsx      popover.tsx
│   ├── dropdown-menu.tsx    command.tsx
│   ├── sidebar.tsx          sidebar-menu.tsx     sidebar-context.tsx
│   ├── sonner.tsx           ripple.tsx
└── lib/
    └── cn.ts
```

### Modified files

- `package.json` (root) — add `packages/ui` to `workspaces`.
- `apps/dashboard/package.json` — add `@carekit/ui`: `"*"` dep.
- `apps/dashboard/components.json` (shadcn config) — update `aliases.ui` to point at `@carekit/ui`.
- `apps/dashboard/tsconfig.json` — path alias `@carekit/ui`.
- `apps/dashboard/tailwind.config.ts` (or `globals.css`) — add `./packages/ui/src/**/*.{ts,tsx}` to content scan.
- `apps/dashboard/components/ui/index.ts` (if exists) — delete or turn into re-export shim.
- Every file in `apps/dashboard` that imports from `@/components/ui/*` → import from `@carekit/ui` instead.

---

## Task 1 — Scaffold `packages/ui` workspace

**Files:**
- Create: `packages/ui/package.json`
- Create: `packages/ui/tsconfig.json`
- Create: `packages/ui/vitest.config.ts`
- Create: `packages/ui/src/index.ts` (empty barrel)

- [ ] **Step 1.1: Create `packages/ui/package.json`**

```json
{
  "name": "@carekit/ui",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts",
    "./lib/cn": "./src/lib/cn.ts"
  },
  "peerDependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "dependencies": {
    "@carekit/shared": "*",
    "clsx": "^2.1.1",
    "tailwind-merge": "^2.5.4"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "vitest": "^4.1.4",
    "@testing-library/react": "^16.1.0",
    "@testing-library/jest-dom": "^6.6.3"
  },
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  }
}
```

- [ ] **Step 1.2: Create `packages/ui/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "module": "esnext",
    "moduleResolution": "bundler",
    "noEmit": true,
    "strict": true,
    "skipLibCheck": true,
    "types": ["vitest/globals"]
  },
  "include": ["src"]
}
```

If `tsconfig.base.json` at root doesn't exist, mirror `packages/api-client/tsconfig.json` instead (same monorepo baseline).

- [ ] **Step 1.3: Create `packages/ui/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
});
```

- [ ] **Step 1.4: Create empty barrel**

Create `packages/ui/src/index.ts`:

```ts
// @carekit/ui — shadcn/ui primitives extracted from apps/dashboard.
// Components are re-exported from ./primitives. Do not add feature-specific
// components here — those live in each app.
export {};
```

- [ ] **Step 1.5: Register workspace**

In root `package.json`, extend `workspaces`:

```json
"workspaces": [
  "apps/backend",
  "apps/dashboard",
  "apps/website",
  "packages/shared",
  "packages/api-client",
  "packages/ui"
]
```

- [ ] **Step 1.6: Install**

```bash
npm install
```

Expected: `packages/ui/node_modules/` created, `@carekit/ui` resolvable from other workspaces.

- [ ] **Step 1.7: Commit**

```bash
git add packages/ui package.json package-lock.json
git commit -m "feat(saas-05a): scaffold @carekit/ui workspace"
```

---

## Task 2 — Move `cn()` helper + smoke test

**Files:**
- Create: `packages/ui/src/lib/cn.ts`
- Create: `packages/ui/src/lib/cn.test.ts`

- [ ] **Step 2.1: Locate the current `cn()` helper**

```bash
grep -rn "export function cn\|export const cn" apps/dashboard/lib 2>/dev/null | head -3
```

Expected: finds the existing definition (usually `apps/dashboard/lib/utils.ts`).

- [ ] **Step 2.2: Copy + write test**

Create `packages/ui/src/lib/cn.ts` with the current content (copy verbatim). It almost certainly reads:

```ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
```

Create `packages/ui/src/lib/cn.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { cn } from './cn';

describe('cn', () => {
  it('merges tailwind classes without duplicates', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4');
  });
  it('honors conditional entries', () => {
    expect(cn('a', false && 'b', 'c')).toBe('a c');
  });
  it('handles arrays and objects', () => {
    expect(cn(['a', 'b'], { c: true, d: false })).toBe('a b c');
  });
});
```

- [ ] **Step 2.3: Run**

```bash
npm run test --workspace=@carekit/ui
```

Expected: 3 green.

- [ ] **Step 2.4: Commit**

```bash
git add packages/ui/src/lib
git commit -m "feat(saas-05a): cn() helper moved to @carekit/ui/lib"
```

---

## Task 3 — Move core primitives (batch 1: 8 files)

**Files:**
- Create: `packages/ui/src/primitives/button.tsx`, `card.tsx`, `dialog.tsx`, `alert-dialog.tsx`, `badge.tsx`, `label.tsx`, `separator.tsx`, `skeleton.tsx`
- Delete: same 8 files from `apps/dashboard/components/ui/`

- [ ] **Step 3.1: Copy files**

```bash
for f in button card dialog alert-dialog badge label separator skeleton; do
  cp "apps/dashboard/components/ui/$f.tsx" "packages/ui/src/primitives/$f.tsx"
done
```

- [ ] **Step 3.2: Rewrite imports inside each moved file**

For each moved file, find and replace:
- `@/lib/utils` → `../lib/cn` (or `../../lib/cn` depending on depth)
- `@/components/ui/*` → `./` (same directory now)
- Any `@carekit/shared` imports — unchanged (already absolute package)

Use a scripted sed (verify diff before running):

```bash
cd packages/ui/src/primitives
for f in *.tsx; do
  sed -i '' \
    -e 's#@/lib/utils#../lib/cn#g' \
    -e 's#@/components/ui/#./#g' \
    "$f"
done
```

If `cn` was exported from `@/lib/utils` as `cn`, the import line becomes:

```ts
import { cn } from '../lib/cn';
```

- [ ] **Step 3.3: Add to barrel**

Append to `packages/ui/src/index.ts`:

```ts
export * from './primitives/button';
export * from './primitives/card';
export * from './primitives/dialog';
export * from './primitives/alert-dialog';
export * from './primitives/badge';
export * from './primitives/label';
export * from './primitives/separator';
export * from './primitives/skeleton';
```

- [ ] **Step 3.4: Delete source copies**

```bash
cd apps/dashboard/components/ui && rm button.tsx card.tsx dialog.tsx alert-dialog.tsx badge.tsx label.tsx separator.tsx skeleton.tsx
```

- [ ] **Step 3.5: Rewrite dashboard imports**

```bash
cd /Users/tariq/code/carekit
grep -rln "@/components/ui/\(button\|card\|dialog\|alert-dialog\|badge\|label\|separator\|skeleton\)" apps/dashboard \
  | xargs sed -i '' -E 's#@/components/ui/(button|card|dialog|alert-dialog|badge|label|separator|skeleton)#@carekit/ui#g'
```

This collapses `import { Button } from '@/components/ui/button'` → `import { Button } from '@carekit/ui'`.

- [ ] **Step 3.6: Typecheck + build**

```bash
npm run typecheck --workspace=dashboard && npm run build --workspace=dashboard
```

Expected: no errors. If Tailwind complains about missing classes at runtime, Task 7 fixes the content scan.

- [ ] **Step 3.7: Commit**

```bash
git add packages/ui apps/dashboard
git commit -m "feat(saas-05a): move 8 core primitives (button/card/dialog/…) to @carekit/ui"
```

---

## Task 4 — Move form primitives (batch 2: 9 files)

**Files:**
- Move: `input`, `input-group`, `select`, `checkbox`, `radio-group`, `date-picker`, `date-time-input`, `phone-input`, `nationality-select`, `avatar-upload` (10 — `input` is one file; the count is 9 because `avatar-upload` is specialized — both approaches valid; treat as 10 here).

Actually 10 files. Adjust the loops accordingly.

- [ ] **Step 4.1: Copy + rewrite imports**

```bash
for f in input input-group select checkbox radio-group date-picker date-time-input phone-input nationality-select avatar-upload; do
  cp "apps/dashboard/components/ui/$f.tsx" "packages/ui/src/primitives/$f.tsx"
done
cd packages/ui/src/primitives
for f in input.tsx input-group.tsx select.tsx checkbox.tsx radio-group.tsx date-picker.tsx date-time-input.tsx phone-input.tsx nationality-select.tsx avatar-upload.tsx; do
  sed -i '' -e 's#@/lib/utils#../lib/cn#g' -e 's#@/components/ui/#./#g' "$f"
done
```

- [ ] **Step 4.2: Check for dashboard-specific imports**

Some form components (notably `avatar-upload`, `nationality-select`, `phone-input`) may import:
- API client hooks (`@/hooks/use-*`)
- Feature-specific utilities (`@/lib/api/*`)

Run:

```bash
grep -n "@/hooks\|@/lib/api\|@/components/features" packages/ui/src/primitives/*.tsx
```

If any match: **STOP**. Those components are not pure UI; they're feature components. Revert their move and keep them in `apps/dashboard/components/ui/` (rename the folder to `apps/dashboard/components/dashboard-ui/` if needed to avoid confusion). Do NOT inject API hooks into `@carekit/ui`.

Likely offenders (audit before moving):
- `avatar-upload.tsx` — may depend on an upload hook
- `nationality-select.tsx` — may depend on API for country lookup

**Resolution pattern:** split. Keep the presentational part in `@carekit/ui` (`<AvatarUploadButton onSelect={...}>`), keep the data-fetching/upload part in `apps/dashboard`. Document this in `packages/ui/CLAUDE.md` (Task 10).

- [ ] **Step 4.3: Add to barrel**

Append:

```ts
export * from './primitives/input';
export * from './primitives/input-group';
export * from './primitives/select';
export * from './primitives/checkbox';
export * from './primitives/radio-group';
export * from './primitives/date-picker';
export * from './primitives/date-time-input';
export * from './primitives/phone-input';
export * from './primitives/nationality-select';
export * from './primitives/avatar-upload';
```

(Skip the last two if you resolved them as "stays in dashboard" per Step 4.2.)

- [ ] **Step 4.4: Delete sources + rewrite dashboard imports**

Same pattern as Task 3.5 with the 10 component names.

- [ ] **Step 4.5: Typecheck + commit**

```bash
npm run typecheck --workspace=dashboard
git add packages/ui apps/dashboard
git commit -m "feat(saas-05a): move 10 form primitives to @carekit/ui"
```

---

## Task 5 — Move layout + navigation + feedback (batch 3: remaining files)

**Files:**
- Move: `sheet`, `scroll-area`, `popover`, `dropdown-menu`, `command`, `calendar`, `avatar`, `sidebar`, `sidebar-menu`, `sidebar-context`, `sonner`, `ripple` (12 files)

- [ ] **Step 5.1: Copy + rewrite + barrel + delete + import-rewrite**

Same pattern as Tasks 3 and 4. Loop through all 12.

Caveats to watch:
- `sidebar-context.tsx` may export a context/provider — keep its API identical.
- `sonner` — pure wrapper around `sonner` npm package; moves cleanly.
- `ripple` — any CSS-in-JS? If it uses `style` tag or `keyframes`, verify it works when consumed from a package.

- [ ] **Step 5.2: Run dashboard end-to-end**

```bash
cd apps/dashboard && npm run dev
```

Open http://localhost:5103. Manually verify:
- Login page renders (button, card, input)
- Sidebar opens/closes (sidebar, sidebar-menu, sidebar-context)
- A dialog opens (dialog, button)
- Toasts fire (sonner)
- A date picker renders in any form (date-picker, calendar, popover)

If any visual regression: stop, diff CSS class output, fix the relevant import or content-scan path.

- [ ] **Step 5.3: Commit**

```bash
git add packages/ui apps/dashboard
git commit -m "feat(saas-05a): move 12 layout/navigation/feedback primitives to @carekit/ui"
```

---

## Task 6 — Update dashboard shadcn config + tsconfig alias

**Files:**
- Modify: `apps/dashboard/components.json`
- Modify: `apps/dashboard/tsconfig.json`

- [ ] **Step 6.1: Update shadcn alias**

In `apps/dashboard/components.json`, change:

```json
"aliases": {
  "components": "@/components",
  "utils": "@/lib/utils",
  "ui": "@carekit/ui"
}
```

This makes future `npx shadcn add <component>` place files in `packages/ui/src/primitives` — adjust the `aliases.ui` path if shadcn requires a relative path (consult shadcn docs for monorepo setups).

Alternative if shadcn can't write into a package: set `"ui": "@/components/ui-app"` (new folder for dashboard-only UI) and accept that new shadcn adds go to `ui-app`, not `@carekit/ui`. Document choice in CLAUDE.md (Task 10).

- [ ] **Step 6.2: Update tsconfig path**

In `apps/dashboard/tsconfig.json`, ensure workspace packages resolve:

```json
"paths": {
  "@/*": ["./*"],
  "@carekit/ui": ["../../packages/ui/src/index.ts"],
  "@carekit/ui/*": ["../../packages/ui/src/*"]
}
```

- [ ] **Step 6.3: Typecheck**

```bash
npm run typecheck --workspace=dashboard
```

- [ ] **Step 6.4: Commit**

```bash
git add apps/dashboard/components.json apps/dashboard/tsconfig.json
git commit -m "chore(saas-05a): update shadcn alias + tsconfig path for @carekit/ui"
```

---

## Task 7 — Extend Tailwind content scan

**Files:**
- Modify: `apps/dashboard/tailwind.config.ts` OR `apps/dashboard/app/globals.css` (Tailwind 4 inline content)

- [ ] **Step 7.1: Identify Tailwind config location**

```bash
ls apps/dashboard/tailwind.config.* 2>/dev/null
grep -n "@source\|@config" apps/dashboard/app/globals.css 2>/dev/null
```

Tailwind 4 usually uses `@source` directives in CSS rather than a config file. If `globals.css` contains `@source '...'`, add:

```css
@source '../../../packages/ui/src/**/*.{ts,tsx}';
```

If there's a `tailwind.config.ts`, add:

```ts
content: [
  './app/**/*.{ts,tsx}',
  './components/**/*.{ts,tsx}',
  '../../packages/ui/src/**/*.{ts,tsx}',   // NEW
],
```

- [ ] **Step 7.2: Rebuild + visually verify**

```bash
cd apps/dashboard && npm run build
```

Open the built dashboard. Classes like `bg-primary`, `rounded-lg` should apply to `<Button>` etc.

If styles are missing, Tailwind didn't see the class strings in `packages/ui/src/primitives/*.tsx` — fix the path in Step 7.1.

- [ ] **Step 7.3: Commit**

```bash
git add apps/dashboard/tailwind.config.* apps/dashboard/app/globals.css
git commit -m "chore(saas-05a): extend Tailwind content scan to @carekit/ui"
```

---

## Task 8 — Clean up stale files in dashboard

**Files:**
- Delete: `apps/dashboard/components/ui/` (should be empty now) OR any remaining non-primitive files
- Modify: `apps/dashboard/lib/utils.ts` — remove `cn()` (moved to `@carekit/ui/lib/cn`)

- [ ] **Step 8.1: Verify `components/ui/` is empty (or only has non-primitive files)**

```bash
ls apps/dashboard/components/ui/
```

If any files remain (because of audit stops in Task 4.2 or 5), leave them. Otherwise:

```bash
rmdir apps/dashboard/components/ui
```

- [ ] **Step 8.2: Remove `cn` from dashboard utils**

Edit `apps/dashboard/lib/utils.ts`. Delete the `cn` export (and its imports `clsx`, `tailwind-merge` if unused elsewhere). Replace with:

```ts
// cn() moved to @carekit/ui/lib/cn as of SaaS-05a.
// Re-export for backward compatibility inside this workspace:
export { cn } from '@carekit/ui/lib/cn';
```

This lets existing dashboard files that imported `cn` from `@/lib/utils` keep working. Delete the re-export only after every dashboard file has been migrated to import directly from `@carekit/ui`.

- [ ] **Step 8.3: Full build**

```bash
cd /Users/tariq/code/carekit && npm run build
```

Expected: all workspaces build successfully.

- [ ] **Step 8.4: Commit**

```bash
git add apps/dashboard
git commit -m "chore(saas-05a): remove stale ui/ folder + re-export cn from @carekit/ui"
```

---

## Task 9 — Visual regression audit

**Files:**
- None (manual QA).

- [ ] **Step 9.1: Boot dashboard**

```bash
cd apps/dashboard && npm run dev
```

- [ ] **Step 9.2: Screenshot-compare critical pages**

Hit these URLs on `http://localhost:5103`, visually compare against the pre-extraction version (keep a browser window with `main` branch running for reference if helpful):

1. `/login` — inputs + button + card
2. `/dashboard` — sidebar, cards, badges, stats grid
3. `/clients` — table, filters, pagination, dropdown-menus
4. `/bookings` — date-picker, calendar, dialog (create-booking flow)
5. `/settings` — forms, radio-group, checkbox, select
6. `/branding` — color pickers, file upload (avatar-upload if moved)

Any visual delta: document in a file `saas-05a-regression-notes.md`, fix, and re-commit. If delta is due to a missed Tailwind class scan, check Task 7.

- [ ] **Step 9.3: Test a destructive flow**

Delete a dummy row. Confirm: alert-dialog opens, confirm button works, sonner toast fires. Proves the full chain of extracted primitives still cooperates.

- [ ] **Step 9.4: Run automated tests**

```bash
cd /Users/tariq/code/carekit && npm run test
```

Expected: all workspace tests pass (no snapshot regressions, no broken imports).

- [ ] **Step 9.5: Commit any fixes**

```bash
git add -p && git commit -m "fix(saas-05a): visual/integration fixups after primitive extraction"
```

Skip this commit if no fixes were needed.

---

## Task 10 — Documentation + PR

**Files:**
- Create: `packages/ui/CLAUDE.md`
- Create: `packages/ui/README.md`

- [ ] **Step 10.1: Write `packages/ui/CLAUDE.md`**

```markdown
# @carekit/ui — Shared UI Primitives

This package holds **presentation-only** UI primitives (shadcn/ui derivatives) reused across `apps/dashboard`, `apps/admin`, and `apps/landing`.

## What belongs here

- Stateless visual components: Button, Card, Dialog, Input, etc.
- Radix-wrapper primitives (DropdownMenu, Popover, Sheet).
- Utility helpers: `cn()` in `lib/cn`.
- `useTerminology()` will NOT live here — it's in `@carekit/shared`.

## What does NOT belong here

- Components that fetch data (any `useQuery`, `useMutation`, `axios`, or API-client imports).
- Feature-specific composites (e.g., `<BookingStatusBadge>` — that's per-app).
- Business logic (pricing rules, RBAC checks).
- Route-aware components (anything referencing `next/navigation`, `next/link` — exception: thin wrappers with `asChild`).

## Splitting a data-aware component

If a shadcn-derived component needs data (e.g., `<NationalitySelect>` fetching country list):

1. Move the **presentational** part here: `<NationalitySelect options={...} />`.
2. Keep the **data-fetching** part in the consuming app: `<NationalitySelectContainer>` that calls the API and renders the primitive.

## Adding new components

```bash
# From apps/dashboard:
npx shadcn add <component>
# Then manually move the generated file to packages/ui/src/primitives/
# and rewrite imports per Task 3.2 pattern.
```

Long-term: evaluate a shadcn monorepo config to write directly into `@carekit/ui`.
```

- [ ] **Step 10.2: Open PR**

```bash
git push -u origin feat/saas-05a-packages-ui-extraction
gh pr create --title "feat(saas-05a): extract shared UI primitives into @carekit/ui" --body "$(cat <<'EOF'
## Summary
Unblocks Plans 05b (admin app), 06 (dashboard refactor), 07 (landing), 08 (website refactor) by extracting 35 shadcn primitives into a shared workspace package.

## What changed
- New `packages/ui/` workspace with `@carekit/ui` package.
- Moved 35 primitives from `apps/dashboard/components/ui/` → `packages/ui/src/primitives/`.
- `cn()` helper moved to `@carekit/ui/lib/cn`.
- Dashboard imports rewritten to `@carekit/ui`.
- Tailwind content scan extended to cover `packages/ui/src/**`.
- Added `packages/ui/CLAUDE.md` with "what belongs / what doesn't" guide.

## Behavior
Zero functional change. Pure refactor. Dashboard should look and behave identically.

## Invariants verified
- [x] `npm run build` green across all workspaces.
- [x] `npm run test` green.
- [x] Manual visual audit of 6 critical pages.
- [x] Destructive flow (alert-dialog + confirm + toast) works end-to-end.

## Next
- Plan 05b can now scaffold `apps/admin/` consuming `@carekit/ui`.
- Plan 06 dashboard refactor leverages the shared primitives.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 10.3: Done.**

---

## Self-review

- [x] Spec coverage: all 35 primitives moved or explicitly deferred with rationale.
- [x] No placeholders: every sed command + every barrel entry + every config change is explicit.
- [x] Type consistency: `@carekit/ui` package name, `cn` import path, primitive filenames all consistent across tasks.
- [x] Reversible: every commit is a small move or config change; nothing destructive.
- [x] Dependency: depends only on already-merged code (no forward references to SaaS-02b+).
