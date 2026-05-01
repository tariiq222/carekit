# Deqah Brand Identity Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the Deqah brand and visual-identity gaps across dashboard, admin, website, mobile, and shared tokens without breaking tenant white-label behavior.

**Architecture:** Treat Deqah as the platform brand and tenant branding as the user-facing clinic/app brand. Add one shared platform-brand source of truth, remove visible legacy names, align color/token defaults, and add a deterministic brand check so regressions are caught before launch.

**Tech Stack:** npm workspaces, Next.js 15 dashboard/admin/website, Expo React Native mobile, `@deqah/shared`, CSS custom properties, Vitest/Jest where already available.

---

## Brand Decision

This plan locks the naming model before code changes:

- **Platform brand:** `Deqah` in English, `دِقة` in Arabic.
- **Platform tagline Arabic:** `نظام إدارة المواعيد والحجوزات للمنشآت`.
- **Platform tagline English:** `Scheduling and appointment operations platform`.
- **Tenant brand:** `PublicBranding.organizationNameAr/En`, tenant logo, tenant colors, tenant website theme.
- **Current mobile build brand:** `سواء للإرشاد الأسري` / `Sawaa`, because `apps/mobile` is locked to the Sawaa tenant.
- **Do not show legacy names** in production UI: `CareKit`, `CAREKIT`, `كيركيت`, `كير كت`.
- **Do not edit existing Prisma migrations** just to rewrite historic comments or old immutable SQL.

## File Map

### Create

- `packages/shared/constants/brand.ts` — canonical platform brand text, colors, and forbidden legacy strings.
- `scripts/check-brand-identity.mjs` — production-surface scanner for forbidden visible brand strings and stale color constants.
- `apps/dashboard/components/brand/deqah-mark.tsx` — reusable Deqah platform mark for dashboard shell.
- `docs/brand/deqah-brand-architecture.md` — short brand architecture decision record.

### Modify

- `packages/shared/constants/index.ts` — export platform brand constants.
- `packages/shared/types/branding.ts` — fix default Arabic name and tagline.
- `packages/shared/tokens/colors.ts` — align shared defaults with Deqah documented colors.
- `apps/dashboard/app/globals.css` — keep dashboard CSS token defaults aligned with shared tokens.
- `apps/dashboard/tokens.md` — update token documentation after alignment.
- `apps/dashboard/components/app-sidebar.tsx` — replace generic medical-mask brand mark.
- `apps/dashboard/lib/translations/ar.nav.ts` and `apps/dashboard/lib/translations/en.nav.ts` — fix app name/tagline.
- `apps/dashboard/lib/translations/ar.billing.ts` and `apps/dashboard/lib/translations/en.billing.ts` — use localized platform name consistently.
- `apps/admin/messages/ar.json` and `apps/admin/messages/en.json` — fix platform naming in admin login/shell copy.
- `apps/admin/app/layout.tsx` — align metadata copy.
- `apps/website/themes/premium/layout/layout.tsx` — remove visible `CAREKIT`; render tenant or platform brand.
- `apps/website/app/layout.tsx` — improve fallback metadata to `دِقة / Deqah`.
- `apps/website/features/branding/branding-style.tsx` — align website fallback colors with shared brand constants.
- `apps/mobile/i18n/ar.json` and `apps/mobile/i18n/en.json` — make user-facing app name Sawaa for the locked mobile build.
- `apps/mobile/theme/tokens.ts` and `apps/mobile/theme/sawaa/tokens.ts` — align fallback colors with Deqah defaults while preserving Sawaa tenant styling.
- `apps/mobile/theme/__tests__/tokens.test.ts` and `apps/mobile/__tests__/theme-tokens.test.ts` — assert fallback/override behavior.
- `package.json` — add `brand:check` script.

---

## Task 1: Add Canonical Platform Brand Constants

**Files:**
- Create: `packages/shared/constants/brand.ts`
- Modify: `packages/shared/constants/index.ts`

- [ ] **Step 1: Create the brand constants file**

Create `packages/shared/constants/brand.ts`:

```ts
export const PLATFORM_BRAND = {
  nameEn: 'Deqah',
  nameAr: 'دِقة',
  taglineEn: 'Scheduling and appointment operations platform',
  taglineAr: 'نظام إدارة المواعيد والحجوزات للمنشآت',
  colors: {
    primary: '#354FD8',
    primaryLight: '#5B72E8',
    primaryDark: '#2438B0',
    accent: '#82CC17',
    accentDark: '#5A9010',
    background: '#EEF1F8',
  },
} as const;

export const LEGACY_BRAND_STRINGS = [
  'CareKit',
  'CAREKIT',
  'carekit',
  'كيركيت',
  'كير كت',
] as const;
```

- [ ] **Step 2: Export the constants**

In `packages/shared/constants/index.ts`, add:

```ts
export { PLATFORM_BRAND, LEGACY_BRAND_STRINGS } from './brand';
```

- [ ] **Step 3: Type-check shared consumers**

Run:

```bash
pnpm --filter=dashboard typecheck
pnpm --filter=website typecheck
pnpm --filter=admin typecheck
```

Expected: no new errors from the new export.

- [ ] **Step 4: Commit**

```bash
git add packages/shared/constants/brand.ts packages/shared/constants/index.ts
git commit -m "chore(brand): add platform brand constants"
```

---

## Task 2: Add a Brand Regression Check

**Files:**
- Create: `scripts/check-brand-identity.mjs`
- Modify: `package.json`

- [ ] **Step 1: Create the scanner**

Create `scripts/check-brand-identity.mjs`:

```js
#!/usr/bin/env node
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();
const productionRoots = [
  'apps/dashboard',
  'apps/admin',
  'apps/website',
  'apps/mobile',
  'packages/shared',
  'packages/ui',
];

const allowedPathFragments = [
  'node_modules',
  '.next',
  '.turbo',
  'coverage',
  'design-prototypes',
  'prisma/migrations',
  'docs/superpowers/qa',
  'docs/superpowers/plans/2026-04-30-deqah-rebrand.md',
  'scripts/check-brand-identity.mjs',
];

const extensions = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.json',
  '.css',
  '.md',
]);

const forbidden = [
  { label: 'legacy CareKit', pattern: /\bCareKit\b/g },
  { label: 'legacy CAREKIT', pattern: /\bCAREKIT\b/g },
  { label: 'legacy carekit', pattern: /\bcarekit\b/g },
  { label: 'legacy Arabic كيركيت', pattern: /كيركيت/g },
  { label: 'legacy Arabic كير كت', pattern: /كير كت/g },
];

function extname(path) {
  const index = path.lastIndexOf('.');
  return index === -1 ? '' : path.slice(index);
}

function shouldSkip(path) {
  const rel = relative(root, path);
  return allowedPathFragments.some((fragment) => rel.includes(fragment));
}

function walk(dir, files = []) {
  if (shouldSkip(dir)) return files;
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (shouldSkip(full)) continue;
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walk(full, files);
      continue;
    }
    if (extensions.has(extname(full))) files.push(full);
  }
  return files;
}

const findings = [];
for (const rootDir of productionRoots) {
  for (const file of walk(join(root, rootDir))) {
    const text = readFileSync(file, 'utf8');
    const lines = text.split('\n');
    lines.forEach((line, index) => {
      for (const rule of forbidden) {
        rule.pattern.lastIndex = 0;
        if (rule.pattern.test(line)) {
          findings.push(`${relative(root, file)}:${index + 1} ${rule.label}: ${line.trim()}`);
        }
      }
    });
  }
}

if (findings.length > 0) {
  console.error('Brand identity check failed:\n');
  console.error(findings.join('\n'));
  process.exit(1);
}

console.log('Brand identity check passed.');
```

- [ ] **Step 2: Add a root script**

In root `package.json` scripts, add:

```json
"brand:check": "node scripts/check-brand-identity.mjs"
```

- [ ] **Step 3: Run and confirm the current failures**

Run:

```bash
pnpm brand:check
```

Expected before cleanup: failure showing production references such as `apps/website/themes/premium/layout/layout.tsx` and stale Arabic names.

- [ ] **Step 4: Commit**

```bash
git add scripts/check-brand-identity.mjs package.json
git commit -m "test(brand): add identity regression check"
```

---

## Task 3: Fix Platform Name and Copy Consistency

**Files:**
- Modify: `packages/shared/types/branding.ts`
- Modify: `apps/dashboard/lib/translations/ar.nav.ts`
- Modify: `apps/dashboard/lib/translations/en.nav.ts`
- Modify: `apps/dashboard/lib/translations/ar.billing.ts`
- Modify: `apps/dashboard/lib/translations/en.billing.ts`
- Modify: `apps/admin/messages/ar.json`
- Modify: `apps/admin/messages/en.json`
- Modify: `apps/admin/app/layout.tsx`

- [ ] **Step 1: Fix shared branding defaults**

In `packages/shared/types/branding.ts`, import the brand constants:

```ts
import { PLATFORM_BRAND } from '../constants/brand';
```

Then replace `DEFAULT_BRANDING` text/color values with:

```ts
export const DEFAULT_BRANDING: BrandingConfig = {
  systemName:        PLATFORM_BRAND.nameEn,
  systemNameAr:      PLATFORM_BRAND.nameAr,
  productTagline:    PLATFORM_BRAND.taglineAr,
  logoUrl:           null,
  faviconUrl:        null,
  colorPrimary:      PLATFORM_BRAND.colors.primary,
  colorPrimaryLight: PLATFORM_BRAND.colors.primaryLight,
  colorPrimaryDark:  PLATFORM_BRAND.colors.primaryDark,
  colorAccent:       PLATFORM_BRAND.colors.accent,
  colorAccentDark:   PLATFORM_BRAND.colors.accentDark,
  colorBackground:   PLATFORM_BRAND.colors.background,
  fontFamily:        'IBM Plex Sans Arabic',
  fontUrl:           'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@300;400;500;600;700;800&display=swap',
};
```

- [ ] **Step 2: Fix dashboard nav brand copy**

Set:

```ts
// apps/dashboard/lib/translations/ar.nav.ts
"app.name": "دِقة",
"app.tagline": "إدارة المواعيد والحجوزات",
```

```ts
// apps/dashboard/lib/translations/en.nav.ts
"app.name": "Deqah",
"app.tagline": "Appointment Operations",
```

- [ ] **Step 3: Fix billing copy**

Use Arabic platform name in Arabic billing copy:

```ts
"billing.paymentMethods.description": "إدارة البطاقات المستخدمة لفوترة اشتراك دِقة.",
"billing.invoices.page.description": "حمّل الفواتير الضريبية لاشتراكك في دِقة.",
```

Keep English copy as:

```ts
"billing.paymentMethods.description": "Manage cards used for Deqah subscription billing.",
"billing.invoices.page.description": "Download tax invoices for your Deqah subscription.",
```

- [ ] **Step 4: Fix admin messages and metadata**

Use:

```json
"title": "دِقة - لوحة الإدارة العليا"
```

for Arabic admin title entries, and:

```json
"description": "للموظفين فقط. سجّل الدخول بحساب دِقة الخاص بك."
```

for Arabic login/admin account descriptions.

In `apps/admin/app/layout.tsx`, keep English metadata:

```ts
title: 'Deqah Super-admin',
description: 'Platform control plane for Deqah staff',
```

- [ ] **Step 5: Verify**

Run:

```bash
pnpm --filter=dashboard typecheck
pnpm --filter=admin typecheck
pnpm brand:check
```

Expected: typechecks pass; `brand:check` may still fail only for remaining tasks not yet cleaned.

- [ ] **Step 6: Commit**

```bash
git add packages/shared/types/branding.ts apps/dashboard/lib/translations apps/admin/messages apps/admin/app/layout.tsx
git commit -m "fix(brand): align platform naming across shell copy"
```

---

## Task 4: Fix Website Brand Leakage

**Files:**
- Modify: `apps/website/themes/premium/layout/layout.tsx`
- Modify: `apps/website/app/layout.tsx`
- Modify: `apps/website/features/branding/branding-style.tsx`

- [ ] **Step 1: Replace visible CAREKIT in premium layout**

In `apps/website/themes/premium/layout/layout.tsx`, import:

```ts
import { getPublicBrandingForSsr } from '@/features/branding/public';
```

Inside `PremiumLayout`, after locale:

```ts
const branding = await getPublicBrandingForSsr();
const brandName = branding.organizationNameAr || branding.organizationNameEn || 'دِقة';
```

Replace the header `CAREKIT` span with:

```tsx
<span style={{ letterSpacing: '0.12em', fontSize: '0.75rem' }}>{brandName}</span>
```

Replace footer text with:

```tsx
PREMIUM · {brandName}
```

- [ ] **Step 2: Improve fallback metadata**

In `apps/website/app/layout.tsx`, change fallback metadata to:

```ts
return {
  title: 'دِقة',
  description: 'Deqah appointment operations platform',
};
```

- [ ] **Step 3: Align website CSS fallback values**

In `apps/website/features/branding/branding-style.tsx`, import:

```ts
import { PLATFORM_BRAND } from '@deqah/shared/constants';
```

Then replace the `DEFAULTS` color values with `PLATFORM_BRAND.colors`:

```ts
const DEFAULTS: Record<string, string> = {
  '--primary': PLATFORM_BRAND.colors.primary,
  '--primary-light': PLATFORM_BRAND.colors.primaryLight,
  '--primary-dark': PLATFORM_BRAND.colors.primaryDark,
  '--accent': PLATFORM_BRAND.colors.accent,
  '--accent-dark': PLATFORM_BRAND.colors.accentDark,
  '--bg': PLATFORM_BRAND.colors.background,
  '--font-primary': "'IBM Plex Sans Arabic', system-ui, sans-serif",
};
```

- [ ] **Step 4: Verify website**

Run:

```bash
pnpm --filter=website typecheck
pnpm --filter=website test
pnpm brand:check
```

Expected: website typecheck/test pass; no `CAREKIT` production UI findings.

- [ ] **Step 5: Commit**

```bash
git add apps/website/themes/premium/layout/layout.tsx apps/website/app/layout.tsx apps/website/features/branding/branding-style.tsx
git commit -m "fix(website): remove legacy brand leakage"
```

---

## Task 5: Align Color Tokens Across Web and Mobile

**Files:**
- Modify: `packages/shared/tokens/colors.ts`
- Modify: `apps/dashboard/app/globals.css`
- Modify: `apps/dashboard/tokens.md`
- Modify: `apps/mobile/theme/tokens.ts`
- Modify: `apps/mobile/theme/sawaa/tokens.ts`
- Modify: `apps/mobile/theme/__tests__/tokens.test.ts`
- Modify: `apps/mobile/__tests__/theme-tokens.test.ts`

- [ ] **Step 1: Align shared color defaults**

In `packages/shared/tokens/colors.ts`, set the primary and secondary source values:

```ts
primary: {
  50: '#EEF1FF',
  100: '#E1E6FF',
  200: '#C5CEFF',
  300: '#9DACF5',
  400: '#7184EA',
  500: '#354FD8',
  600: '#354FD8',
  700: '#2438B0',
  800: '#1E2E86',
  900: '#18235F',
},
secondary: {
  50: '#F5FCEB',
  100: '#EAF8D4',
  200: '#D7F0AA',
  300: '#BCE677',
  400: '#9DDA3F',
  500: '#82CC17',
  600: '#5A9010',
  700: '#426D0B',
  800: '#2D4B08',
  900: '#1D3205',
},
```

- [ ] **Step 2: Keep dashboard defaults unchanged but documented**

Confirm `apps/dashboard/app/globals.css` still uses:

```css
--primary: #354FD8;
--primary-light: #5B72E8;
--primary-dark: #2438B0;
--accent: #82CC17;
```

If `--primary-dark` is missing, add it to `:root` and map it in `@theme inline` as `--color-primary-dark: var(--primary-dark);`.

- [ ] **Step 3: Align mobile fallback defaults**

In `apps/mobile/theme/sawaa/tokens.ts`, set:

```ts
primary: {
  light: '#354FD8',
  dark: '#2438B0',
},
accent: {
  light: '#82CC17',
  dark: '#5A9010',
},
```

In `apps/mobile/theme/tokens.ts`, fallback remains token-based:

```ts
const primary = isValidColor(branding?.colorPrimary)
  ? branding.colorPrimary
  : colors.primary[600];
```

- [ ] **Step 4: Strengthen mobile tests**

In `apps/mobile/theme/__tests__/tokens.test.ts`, change the first test to assert exact fallback values:

```ts
it('falls back to Deqah platform defaults when no branding is loaded', () => {
  const t = buildTheme();
  expect(t.colors.primary).toBe('#354FD8');
  expect(t.colors.accent).toBe('#82CC17');
  expect(t.colors.background).toBe('#F7F9FB');
});
```

In `apps/mobile/__tests__/theme-tokens.test.ts`, add:

```ts
it('uses Deqah defaults for the locked Sawaa token fallback', () => {
  expect(sawaaTokens.primary.light).toBe('#354FD8');
  expect(sawaaTokens.primary.dark).toBe('#2438B0');
  expect(sawaaTokens.accent.light).toBe('#82CC17');
  expect(sawaaTokens.accent.dark).toBe('#5A9010');
});
```

- [ ] **Step 5: Verify**

Run:

```bash
pnpm --filter=deqah-mobile test -- theme
pnpm --filter=dashboard typecheck
pnpm --filter=website typecheck
```

Expected: mobile theme tests pass; web typechecks pass.

- [ ] **Step 6: Commit**

```bash
git add packages/shared/tokens/colors.ts apps/dashboard/app/globals.css apps/dashboard/tokens.md apps/mobile/theme apps/mobile/__tests__/theme-tokens.test.ts
git commit -m "fix(brand): align platform color tokens"
```

---

## Task 6: Fix Mobile Tenant/App Brand Boundary

**Files:**
- Modify: `apps/mobile/i18n/ar.json`
- Modify: `apps/mobile/i18n/en.json`
- Review only: `apps/mobile/constants/config.ts`

- [ ] **Step 1: Make mobile user-facing app name match the locked tenant**

In `apps/mobile/i18n/ar.json`:

```json
"appName": "سواء"
```

In `apps/mobile/i18n/en.json`:

```json
"appName": "Sawaa"
```

Keep `apps/mobile/constants/config.ts` unchanged:

```ts
export const APP_NAME = 'سواء للإرشاد الأسري';
export const APP_SCHEME = 'sawa';
```

- [ ] **Step 2: Scan mobile for platform brand in user-facing surfaces**

Run:

```bash
rg -n "Deqah|دِقة|CareKit|CAREKIT|كيركيت|كير كت" apps/mobile/app apps/mobile/components apps/mobile/i18n
```

Expected: no user-facing platform brand except developer docs/comments or platform/legal contexts explicitly accepted by product.

- [ ] **Step 3: Verify mobile tests**

Run:

```bash
pnpm --filter=deqah-mobile test
```

Expected: mobile Jest suite passes or only known unrelated baseline failures are documented.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/i18n/ar.json apps/mobile/i18n/en.json
git commit -m "fix(mobile): respect locked tenant app branding"
```

---

## Task 7: Replace Generic Medical Platform Mark

**Files:**
- Create: `apps/dashboard/components/brand/deqah-mark.tsx`
- Modify: `apps/dashboard/components/app-sidebar.tsx`

- [ ] **Step 1: Create a simple token-safe Deqah mark**

Create `apps/dashboard/components/brand/deqah-mark.tsx`:

```tsx
export function DeqahMark() {
  return (
    <div
      aria-hidden="true"
      className="relative flex aspect-square size-10 items-center justify-center rounded-[16px] bg-primary text-primary-foreground shadow-primary"
    >
      <span className="translate-y-[-1px] text-xl font-bold leading-none">د</span>
      <span className="absolute bottom-2 h-1 w-4 rounded-full bg-accent" />
    </div>
  );
}
```

- [ ] **Step 2: Use the mark in the dashboard sidebar**

In `apps/dashboard/components/app-sidebar.tsx`, remove:

```ts
MedicalMaskIcon,
```

from the icon imports and add:

```ts
import { DeqahMark } from "@/components/brand/deqah-mark"
```

Replace:

```tsx
<div className="flex aspect-square size-10 items-center justify-center rounded-[16px] bg-gradient-to-br from-primary to-primary-light text-primary-foreground shadow-primary">
  <HugeiconsIcon icon={MedicalMaskIcon} size={20} />
</div>
```

with:

```tsx
<DeqahMark />
```

- [ ] **Step 3: Verify**

Run:

```bash
pnpm --filter=dashboard typecheck
pnpm --filter=dashboard lint
```

Expected: no unused icon imports and no lint/type errors.

- [ ] **Step 4: Commit**

```bash
git add apps/dashboard/components/brand/deqah-mark.tsx apps/dashboard/components/app-sidebar.tsx
git commit -m "fix(dashboard): replace generic platform mark"
```

---

## Task 8: Repair Brand Documentation

**Files:**
- Create: `docs/brand/deqah-brand-architecture.md`
- Modify: `docs/superpowers/plans/2026-04-30-deqah-rebrand.md`
- Modify: `docs/superpowers/specs/2026-04-30-deqah-rebrand-design.md`

- [ ] **Step 1: Add the brand architecture document**

Create `docs/brand/deqah-brand-architecture.md`:

```md
# Deqah Brand Architecture

Date: 2026-05-01

## Locked Decision

Deqah / دِقة is the platform brand.

Tenant brands, such as Sawaa / سواء, are customer-facing brands on public websites and locked mobile builds.

## Platform Brand

- English: Deqah
- Arabic: دِقة
- Arabic tagline: نظام إدارة المواعيد والحجوزات للمنشآت
- English tagline: Scheduling and appointment operations platform
- Primary color: #354FD8
- Accent color: #82CC17

## Tenant Brand

Tenant-facing surfaces must prefer `PublicBranding`:

- `organizationNameAr`
- `organizationNameEn`
- `logoUrl`
- `faviconUrl`
- `colorPrimary`
- `colorAccent`
- `fontFamily`
- `activeWebsiteTheme`

## Current Mobile Build

The current mobile build is locked to Sawaa:

- App name: سواء للإرشاد الأسري
- Scheme: sawa
- Bundle: sa.sawa.app

Therefore mobile user-facing copy should say Sawaa, not Deqah, unless the copy is explicitly about the platform provider.

## Forbidden in Production UI

- CareKit
- CAREKIT
- carekit
- كيركيت
- كير كت
```

- [ ] **Step 2: Preserve old/new meaning in the rebrand docs**

In both rebrand docs, avoid self-replacement text like `Deqah → Deqah`. Replace the summary with:

```md
> Historical note: this document originally tracked the migration from the old CareKit brand to the Deqah / دِقة platform brand. Do not run blind global replacement against this file again; it must preserve old/new context for auditability.
```

Keep the file as historical evidence; do not use it as the source of truth after this remediation. Link to:

```md
Current brand architecture: `docs/brand/deqah-brand-architecture.md`
```

- [ ] **Step 3: Verify docs**

Run:

```bash
pnpm brand:check
rg -n "Deqah → Deqah|deqah → deqah|CAREKIT" docs/superpowers/plans/2026-04-30-deqah-rebrand.md docs/superpowers/specs/2026-04-30-deqah-rebrand-design.md
```

Expected: `brand:check` passes for production paths; historical docs may contain old names only inside explicit historical context.

- [ ] **Step 4: Commit**

```bash
git add docs/brand/deqah-brand-architecture.md docs/superpowers/plans/2026-04-30-deqah-rebrand.md docs/superpowers/specs/2026-04-30-deqah-rebrand-design.md
git commit -m "docs(brand): document Deqah brand architecture"
```

---

## Task 9: Final Verification and Browser QA

**Files:**
- No planned edits unless verification exposes a bug.

- [ ] **Step 1: Run static gates**

Run:

```bash
pnpm brand:check
pnpm --filter=dashboard typecheck
pnpm --filter=admin typecheck
pnpm --filter=website typecheck
pnpm --filter=deqah-mobile test -- theme
```

Expected: all pass, or unrelated baseline failures are written to `docs/superpowers/notes/pre-existing-test-failures.md`.

- [ ] **Step 2: Run targeted UI smoke checks**

Start local apps if needed:

```bash
pnpm dev:dashboard
pnpm dev:admin
pnpm dev:website
```

Check:

- Dashboard sidebar shows `دِقة` in Arabic and `Deqah` in English.
- Dashboard sidebar mark is not a medical-mask icon.
- Admin login/shell says Deqah/دِقة consistently.
- Website Premium layout does not show `CAREKIT`.
- Website Sawaa layout still uses tenant brand from `PublicBranding`.
- Mobile current build copy says Sawaa/سواء in user-facing app-name positions.

- [ ] **Step 3: Run final grep**

Run:

```bash
rg -n "CareKit|CAREKIT|carekit|كيركيت|كير كت" apps/dashboard apps/admin apps/website apps/mobile packages/shared packages/ui --glob '!**/node_modules/**' --glob '!**/.next/**' --glob '!**/.turbo/**' --glob '!**/coverage/**' --glob '!**/design-prototypes/**'
```

Expected: zero production UI hits.

- [ ] **Step 4: Commit any verification-only fixes**

If the smoke check exposes small missed copy/tokens:

```bash
git add <changed-files>
git commit -m "fix(brand): close identity verification gaps"
```

---

## Execution Notes

- Do not use global `sed` blindly. The previous rebrand docs already show why this is risky.
- Do not edit existing Prisma migration files for brand cleanup.
- Do not replace tenant-facing Sawaa copy with Deqah in mobile or Sawaa website theme.
- Do not hardcode Deqah colors inside JSX/TSX UI components; use CSS variables or shared tokens.
- If a surface is tenant-facing, prefer `PublicBranding`.
- If a surface is platform/admin/billing provider-facing, use `PLATFORM_BRAND`.

## Completion Definition

The work is complete when:

- `pnpm brand:check` passes.
- Dashboard/admin/website/mobile targeted gates pass or unrelated baseline failures are documented.
- No production UI displays `CareKit`, `CAREKIT`, `كيركيت`, or `كير كت`.
- Dashboard/admin platform surfaces consistently use Deqah/دِقة.
- Mobile user-facing app-name surfaces consistently use Sawaa/سواء for the current locked build.
- The shared brand colors resolve to `#354FD8` and `#82CC17` across dashboard, website fallback, shared tokens, and mobile fallback.
