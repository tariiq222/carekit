# SaaS-06 — Dashboard Terminology + EN i18n Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the tenant dashboard at `apps/dashboard/` so that (a) every user-facing string flows through `t()` / `tp()` / `tTerm()`, (b) the English translation covers the full surface (AR is default today), (c) RTL/LTR direction toggles with the active locale, (d) vertical-aware terminology comes from `useTerminology()` (Plan 03), (e) feature visibility is gated by `currentPlan.limits` (Plan 04), (f) a tenant switcher lets users belonging to multiple orgs switch context, and (g) a new `/settings/billing` page plus a sidebar usage widget surface the subscription state from Plan 04.

**Architecture:** next-intl continues as the i18n engine (already wired per `apps/dashboard/CLAUDE.md`). Terminology lives in `@deqah/shared/terminology` with a React hook `useTerminology(key)` that reads `organization.verticalId` from the `OrgContext` and returns the vertical's label for `key` (e.g. `booking.verb` → "احجز موعد" vs "احجز جلسة"). Feature gating is a new `<FeatureGate feature="chatbot">` that reads the active `currentPlan.limits` from `BillingContext` and conditionally renders. Tenant switcher lives in the top-right of the app shell; switching calls `POST /api/v1/auth/switch-org`, receives a fresh JWT, and React-Query cache is flushed. Billing UI consumes endpoints added in Plan 04.

**Tech Stack:** Next.js 15 App Router, React 19, next-intl, TanStack Query v5, `@deqah/ui` (from Plan 05a), `@deqah/shared` (terminology bundles from Plan 03), Zod, React Hook Form. Tests: Vitest + `@testing-library/react`. QA gate: Chrome DevTools MCP + Kiwi sync.

---

## Critical lessons from prior plans — READ BEFORE STARTING

1. **Grep before refactoring.** Hardcoded strings hide in `toast()` calls, `console.error` messages, `aria-label`, `placeholder`, `title`, `alt`, Zod schema `message:` fields, and date-format fallbacks. Plan Task 1 is an exhaustive grep — do NOT start refactoring pages until the checklist is finalized.
2. **No `any` in TypeScript** — the new `useTerminology` hook must be strongly typed off `@deqah/shared`'s terminology bundle.
3. **350-line max per file** — some dashboard pages are already near the cap. Extracting translations may push them over; extract helper subcomponents proactively.
4. **RTL-first layout** — never hardcode `left`/`right`. Use `ps-` / `pe-` / `ms-` / `me-`. The direction toggle in Task 5 flips the *document* direction; component-level classes must already be logical.
5. **Semantic tokens only** — no hex colors, no `text-gray-*`.
6. **`t()` missing keys should fail loudly in dev.** Configure next-intl with `onError` + `getMessageFallback` throwing in non-production.
7. **Divergence-before-commit** — any discrepancy (e.g. a page imports a component that itself has hardcoded strings not listed in Task 1) means stop + document + amend.

---

## Scope

### In-scope

1. **i18n audit:** exhaustive list of every hardcoded AR/EN literal in `apps/dashboard/app/` + `apps/dashboard/components/`. Deliverable is a markdown checklist that each subsequent task consumes.
2. **EN translation coverage:** complete all `en.*.ts` files in `apps/dashboard/lib/translations/` so every `ar.*` key has an `en.*` counterpart.
3. **`t()` / `tp()` / `tTerm()` refactor** for 8 representative categories: bookings, clients, employees, services, branches, settings, billing, activity-log. Each is its own task; the remaining categories follow the same recipe.
4. **Direction provider:** `<DirectionProvider>` sets `dir="rtl"` or `dir="ltr"` based on `useLocale()`.
5. **Terminology hook:** add `useTerminology()` wrapper over Plan 03's terminology bundle.
6. **Feature gating:** `<FeatureGate feature="chatbot">` component + `useFeatureEnabled()` hook reading from `BillingContext`.
7. **Tenant switcher:** UI component + `useMemberships()` hook + `switchOrganization()` mutation + JWT refresh + React Query cache invalidation.
8. **Billing UI:** sidebar usage widget + `/settings/billing` page with current plan, usage bars, invoice list, upgrade/downgrade CTAs.
9. **Backend endpoints:** `GET /api/v1/me/memberships` + `POST /api/v1/auth/switch-org`.
10. **Tests:** Vitest specs for new hooks/components + i18n snapshot that every page renders with only `t()`-derived strings.
11. **QA gate:** Chrome DevTools MCP on bookings/services/billing in both `ar` and `en`. Kiwi manual-QA sync.

### Explicitly deferred

- RTL-specific typographic tuning (kerning per-font) — later polish plan.
- Mobile app i18n — out of scope (mobile is paused).
- Marketing site i18n — Plan 07.
- Arabic-English MIXED content within one string (e.g. dates with English numerals) — handled per-field where needed, not globally.

---

## File Structure

### New files

| File | Responsibility |
|---|---|
| `apps/dashboard/lib/i18n/direction-provider.tsx` | `<DirectionProvider>` sets `<html dir="…">` |
| `apps/dashboard/lib/i18n/use-terminology.ts` | Hook returning vertical-aware labels from `@deqah/shared/terminology` |
| `apps/dashboard/lib/billing/billing-context.tsx` | React context carrying `currentPlan.limits` + `usage` |
| `apps/dashboard/lib/billing/use-current-plan.ts` | TanStack Query hook for the active subscription |
| `apps/dashboard/components/feature-gate.tsx` | `<FeatureGate feature="chatbot" fallback={…}>` |
| `apps/dashboard/hooks/use-feature-enabled.ts` | Programmatic feature check |
| `apps/dashboard/hooks/use-memberships.ts` | Lists orgs the current user belongs to |
| `apps/dashboard/hooks/use-switch-organization.ts` | Mutation that calls `/auth/switch-org` + flushes caches |
| `apps/dashboard/components/tenant-switcher.tsx` | App-shell top-right switcher |
| `apps/dashboard/components/billing-usage-widget.tsx` | Sidebar progress bar |
| `apps/dashboard/app/(dashboard)/settings/billing/page.tsx` | Billing page (<150 lines orchestration) |
| `apps/dashboard/components/features/billing/*` | Plan card, usage table, invoice list, upgrade dialog |
| `apps/dashboard/test/i18n-snapshot.spec.tsx` | Snapshot test: every page renders with no untranslated literal |
| `apps/dashboard/test/feature-gate.spec.tsx` | FeatureGate behavior |
| `apps/dashboard/test/tenant-switcher.spec.tsx` | TenantSwitcher behavior |
| `apps/dashboard/test/billing-usage-widget.spec.tsx` | Widget behavior |
| `apps/dashboard/test/use-terminology.spec.tsx` | Hook behavior |

### Modified files

| File | Change |
|---|---|
| `apps/dashboard/app/layout.tsx` | Wrap children with `<DirectionProvider>` + `<BillingContext.Provider>` |
| `apps/dashboard/lib/translations/en.*.ts` (all) | Fill in missing keys to match `ar.*.ts` |
| `apps/dashboard/lib/translations/ar.ts` | Audit: verify every key listed in Task 1 exists |
| `apps/dashboard/components/locale-provider.tsx` | Read locale, pass into `<DirectionProvider>` |
| `apps/dashboard/next.config.mjs` | Confirm `i18n.locales = ['ar', 'en']`, default `'ar'` |
| `apps/dashboard/components/sidebar-config.ts` | Hide items based on `useFeatureEnabled(feature)` |
| `apps/dashboard/app/(dashboard)/layout.tsx` | Mount `<TenantSwitcher>` + `<BillingUsageWidget>` |
| `apps/dashboard/app/(dashboard)/bookings/page.tsx` + `clients/...` + `employees/...` + `services/...` + `branches/...` + `settings/...` + `activity-log/...` | Replace hardcoded strings with `t()/tp()/tTerm()` |
| `apps/dashboard/components/features/**/*.tsx` | Same replacement |
| `apps/dashboard/CLAUDE.md` | Add section: "Terminology + i18n + gating + tenant switcher" |

### Backend additions

| File | Change |
|---|---|
| `apps/backend/src/api/dashboard/auth/auth.controller.ts` | Add `POST /auth/switch-org` endpoint |
| `apps/backend/src/api/dashboard/me/me.controller.ts` | Add `GET /me/memberships` endpoint (create controller if absent) |
| `apps/backend/src/modules/identity/switch-organization/` | New handler |
| `apps/backend/src/modules/identity/list-memberships/` | New handler |

---

## Task 1 — i18n audit (comprehensive grep + checklist)

- [ ] **Step 1.1: Grep Arabic literals in .tsx**

```bash
cd apps/dashboard
grep -rn '[؀-ۿ]' app/ components/ --include="*.tsx" --include="*.ts" \
  > .i18n-audit/arabic-literals.txt
```

(Create `.i18n-audit/` — not committed; add to `.gitignore`.)

- [ ] **Step 1.2: Grep English literal candidates**

English literal strings in JSX children or common-attribute values. More signal-heavy than noise-heavy:

```bash
grep -rnE '(placeholder|aria-label|title|alt)="[A-Z][a-zA-Z ]{3,}"' app/ components/ --include="*.tsx" \
  >> .i18n-audit/english-literals.txt
grep -rnE '>[A-Z][a-zA-Z ]{3,}<' app/ components/ --include="*.tsx" \
  >> .i18n-audit/english-literals.txt
grep -rnE "toast\.(success|error|info|warning)\(['\"]" app/ components/ --include="*.tsx" \
  >> .i18n-audit/english-literals.txt
```

- [ ] **Step 1.3: Audit Zod schemas**

```bash
grep -rn "message:" lib/schemas/ --include="*.ts" > .i18n-audit/zod-messages.txt
```

Every Zod `message:` string must route through `t()` — either via a `z.string({ required_error: t('…') })` factory called inside the component (not at module load) or via the next-intl Zod error map.

- [ ] **Step 1.4: Produce `.i18n-audit/checklist.md`**

For each file, list the literal strings found, their approximate line numbers, and a TODO checkbox. The executor ticks boxes as each file is refactored.

- [ ] **Step 1.5: Commit the audit tooling + findings**

```bash
# Add to dashboard's .gitignore:
echo ".i18n-audit/" >> apps/dashboard/.gitignore
git add apps/dashboard/.gitignore
git commit -m "chore(saas-06): reserve .i18n-audit/ for local audit outputs"
```

(The audit output itself is scratch, not committed.)

---

## Task 2 — Complete `en.*.ts` translation files

- [ ] **Step 2.1: Verify AR/EN parity script**

Create `apps/dashboard/scripts/verify-translation-parity.mjs`:

```js
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const dir = 'lib/translations';
const arFiles = readdirSync(dir).filter(f => f.startsWith('ar.') && f.endsWith('.ts'));

let missing = 0;
for (const ar of arFiles) {
  const en = ar.replace(/^ar\./, 'en.');
  const arKeys = extractKeys(readFileSync(join(dir, ar), 'utf8'));
  const enKeys = extractKeys(readFileSync(join(dir, en), 'utf8'));
  const absent = arKeys.filter(k => !enKeys.includes(k));
  if (absent.length) {
    console.error(`${en}: missing ${absent.length} keys:`, absent);
    missing += absent.length;
  }
}
process.exit(missing === 0 ? 0 : 1);

function extractKeys(src) {
  return [...src.matchAll(/^\s*([a-zA-Z0-9_]+):/gm)].map(m => m[1]);
}
```

- [ ] **Step 2.2: Run parity check**

```bash
cd apps/dashboard && node scripts/verify-translation-parity.mjs
```

Expected: a list of keys missing in `en.*.ts`.

- [ ] **Step 2.3: Fill in English translations**

For each missing key reported, add an English value in the matching `en.*.ts`. Work file-by-file:

```
en.bookings.ts  en.clients.ts  en.employees.ts  en.services.ts
en.branches.ts  en.settings.ts  en.finance.ts  en.nav.ts
en.ops.ts  en.misc.ts  en.chatbot.ts  en.chatbot-extended.ts
en.intake-forms.ts  en.branding.ts  en.dashboard.ts  en.departments.ts
en.ts  en.users.ts
```

- [ ] **Step 2.4: Parity check passes**

```bash
cd apps/dashboard && node scripts/verify-translation-parity.mjs
```

Expected: exit 0.

- [ ] **Step 2.5: Wire parity script into CI**

Edit `apps/dashboard/package.json`:

```json
"scripts": {
  // …
  "i18n:verify": "node scripts/verify-translation-parity.mjs"
}
```

And add to the Pre-PR checklist in `apps/dashboard/CLAUDE.md`.

- [ ] **Step 2.6: Commit**

```bash
git add apps/dashboard/lib/translations/ apps/dashboard/scripts/verify-translation-parity.mjs apps/dashboard/package.json
git commit -m "feat(saas-06): English translation parity + verify script"
```

---

## Task 3 — DirectionProvider + locale-aware layout

- [ ] **Step 3.1: Write failing test**

Create `apps/dashboard/test/direction-provider.spec.tsx`:

```tsx
import { render } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { DirectionProvider } from '@/lib/i18n/direction-provider';

describe('DirectionProvider', () => {
  it('sets dir="rtl" when locale=ar', () => {
    render(
      <NextIntlClientProvider locale="ar" messages={{}}>
        <DirectionProvider><div /></DirectionProvider>
      </NextIntlClientProvider>,
    );
    expect(document.documentElement.getAttribute('dir')).toBe('rtl');
  });

  it('sets dir="ltr" when locale=en', () => {
    render(
      <NextIntlClientProvider locale="en" messages={{}}>
        <DirectionProvider><div /></DirectionProvider>
      </NextIntlClientProvider>,
    );
    expect(document.documentElement.getAttribute('dir')).toBe('ltr');
  });
});
```

- [ ] **Step 3.2: Run — fail.**

```bash
cd apps/dashboard && npm run test -- direction-provider
```

- [ ] **Step 3.3: Implement**

Create `apps/dashboard/lib/i18n/direction-provider.tsx`:

```tsx
'use client';
import { useLocale } from 'next-intl';
import { useEffect } from 'react';

export function DirectionProvider({ children }: { children: React.ReactNode }) {
  const locale = useLocale();
  const dir = locale === 'ar' ? 'rtl' : 'ltr';
  useEffect(() => {
    document.documentElement.setAttribute('dir', dir);
    document.documentElement.setAttribute('lang', locale);
  }, [dir, locale]);
  return <>{children}</>;
}
```

- [ ] **Step 3.4: Wire into `app/layout.tsx`**

```tsx
<NextIntlClientProvider locale={locale} messages={messages}>
  <DirectionProvider>
    {children}
  </DirectionProvider>
</NextIntlClientProvider>
```

- [ ] **Step 3.5: Run tests — pass. Manual check: toggle locale, observe `dir` attribute flips + Tailwind logical properties swap sides.**

- [ ] **Step 3.6: Commit**

```bash
git add apps/dashboard/lib/i18n/direction-provider.tsx apps/dashboard/app/layout.tsx apps/dashboard/test/direction-provider.spec.tsx
git commit -m "feat(saas-06): DirectionProvider for locale-aware dir attribute"
```

---

## Task 4 — useTerminology hook

- [ ] **Step 4.1: Verify terminology package from Plan 03 exists**

```bash
ls packages/shared/src/terminology/
```

Expected: per-vertical bundles like `dental.ts`, `salon.ts`, + a `TerminologyKey` union type. If absent, Plan 03 hasn't landed — STOP and flag.

- [ ] **Step 4.2: Write failing test**

Create `apps/dashboard/test/use-terminology.spec.tsx`:

```tsx
import { renderHook } from '@testing-library/react';
import { useTerminology } from '@/lib/i18n/use-terminology';
import { OrgContext } from '@/lib/org-context';

function wrap(verticalId: string, locale: 'ar' | 'en' = 'ar') {
  return ({ children }: any) => (
    <NextIntlClientProvider locale={locale} messages={{}}>
      <OrgContext.Provider value={{ id: 'o1', verticalId, slug: 'x', nameAr: 'ع', nameEn: 'X' }}>
        {children}
      </OrgContext.Provider>
    </NextIntlClientProvider>
  );
}

it('returns dental term for dental org', () => {
  const { result } = renderHook(() => useTerminology('booking.verb'), { wrapper: wrap('dental') });
  expect(result.current).toBe('احجز موعد');
});

it('returns salon term for salon org', () => {
  const { result } = renderHook(() => useTerminology('booking.verb'), { wrapper: wrap('salon') });
  expect(result.current).toBe('احجز جلسة');
});
```

- [ ] **Step 4.3: Run — fail. Implement.**

Create `apps/dashboard/lib/i18n/use-terminology.ts`:

```ts
'use client';
import { useContext } from 'react';
import { useLocale } from 'next-intl';
import { OrgContext } from '@/lib/org-context';
import { getTerminology, type TerminologyKey } from '@deqah/shared/terminology';

export function useTerminology(key: TerminologyKey): string {
  const org = useContext(OrgContext);
  const locale = useLocale() as 'ar' | 'en';
  if (!org) throw new Error('useTerminology requires OrgContext');
  return getTerminology(org.verticalId, locale, key);
}
```

- [ ] **Step 4.4: Expose `tTerm` alias**

In `apps/dashboard/lib/i18n/index.ts`:

```ts
export { useTerminology as tTerm } from './use-terminology';
```

- [ ] **Step 4.5: Run tests — pass. Commit.**

```bash
git add apps/dashboard/lib/i18n/
git commit -m "feat(saas-06): useTerminology hook over @deqah/shared terminology"
```

---

## Task 5 — BillingContext + useCurrentPlan hook

- [ ] **Step 5.1: Verify Plan 04 endpoints exist**

```bash
grep -rn "subscriptions\|currentPlan" apps/backend/src/api/dashboard --include="*.ts" | head
```

Expected: endpoints for fetching the active subscription (e.g. `GET /api/v1/dashboard/billing/current`). If not, STOP — Plan 04 hasn't landed.

- [ ] **Step 5.2: Write failing test + implement `useCurrentPlan`**

Create `apps/dashboard/hooks/use-current-plan.ts` as a TanStack Query hook keyed on `['billing', 'current']`. Mock the API layer in the spec.

- [ ] **Step 5.3: Create BillingContext**

Create `apps/dashboard/lib/billing/billing-context.tsx`:

```tsx
'use client';
import { createContext, useContext } from 'react';
import { useCurrentPlan } from '@/hooks/use-current-plan';

export interface PlanLimits {
  maxBookingsPerMonth: number;
  maxEmployees: number;
  chatbotEnabled: boolean;
  customDomainEnabled: boolean;
  websiteEnabled: boolean;
  // …per Plan 04's limits schema
}

export interface BillingState {
  plan: { id: string; name: string; priceSar: number; limits: PlanLimits } | null;
  usage: { bookingsThisMonth: number; employeeCount: number } | null;
  isLoading: boolean;
}

const BillingContext = createContext<BillingState>({ plan: null, usage: null, isLoading: true });

export function BillingProvider({ children }: { children: React.ReactNode }) {
  const { data, isLoading } = useCurrentPlan();
  return (
    <BillingContext.Provider value={{ plan: data?.plan ?? null, usage: data?.usage ?? null, isLoading }}>
      {children}
    </BillingContext.Provider>
  );
}

export function useBilling() { return useContext(BillingContext); }
```

- [ ] **Step 5.4: Wire into app layout**

```tsx
<NextIntlClientProvider …>
  <DirectionProvider>
    <BillingProvider>{children}</BillingProvider>
  </DirectionProvider>
</NextIntlClientProvider>
```

- [ ] **Step 5.5: Commit**

```bash
git add apps/dashboard/lib/billing apps/dashboard/hooks/use-current-plan.ts apps/dashboard/app/layout.tsx
git commit -m "feat(saas-06): BillingContext + useCurrentPlan hook"
```

---

## Task 6 — FeatureGate

- [ ] **Step 6.1: Write failing test**

Create `apps/dashboard/test/feature-gate.spec.tsx`:

```tsx
import { render } from '@testing-library/react';
import { FeatureGate } from '@/components/feature-gate';
import { BillingContext } from '@/lib/billing/billing-context';

function withLimits(limits: any) {
  return ({ children }: any) => (
    <BillingContext.Provider value={{ plan: { id: 'p', name: 'P', priceSar: 0, limits }, usage: null, isLoading: false }}>
      {children}
    </BillingContext.Provider>
  );
}

it('renders children when feature enabled', () => {
  const { getByText } = render(
    <FeatureGate feature="chatbot"><span>Inside</span></FeatureGate>,
    { wrapper: withLimits({ chatbotEnabled: true }) },
  );
  expect(getByText('Inside')).toBeInTheDocument();
});

it('renders fallback when feature disabled', () => {
  const { getByText, queryByText } = render(
    <FeatureGate feature="chatbot" fallback={<span>Upgrade</span>}><span>Inside</span></FeatureGate>,
    { wrapper: withLimits({ chatbotEnabled: false }) },
  );
  expect(queryByText('Inside')).toBeNull();
  expect(getByText('Upgrade')).toBeInTheDocument();
});
```

- [ ] **Step 6.2: Run — fail. Implement.**

Create `apps/dashboard/components/feature-gate.tsx`:

```tsx
'use client';
import { useBilling } from '@/lib/billing/billing-context';
import { useFeatureEnabled } from '@/hooks/use-feature-enabled';

export type FeatureKey = 'chatbot' | 'customDomain' | 'website' | 'intakeForms' | 'groupSessions';

export function FeatureGate({
  feature, children, fallback = null,
}: { feature: FeatureKey; children: React.ReactNode; fallback?: React.ReactNode }) {
  const enabled = useFeatureEnabled(feature);
  return <>{enabled ? children : fallback}</>;
}
```

Create `apps/dashboard/hooks/use-feature-enabled.ts`:

```ts
import { useBilling } from '@/lib/billing/billing-context';
import type { FeatureKey } from '@/components/feature-gate';

const LIMIT_KEY: Record<FeatureKey, keyof NonNullable<ReturnType<typeof useBilling>['plan']>['limits']> = {
  chatbot: 'chatbotEnabled',
  customDomain: 'customDomainEnabled',
  website: 'websiteEnabled',
  intakeForms: 'intakeFormsEnabled',
  groupSessions: 'groupSessionsEnabled',
};

export function useFeatureEnabled(feature: FeatureKey): boolean {
  const { plan } = useBilling();
  if (!plan) return false;
  return Boolean(plan.limits[LIMIT_KEY[feature]]);
}
```

- [ ] **Step 6.3: Gate sidebar items**

Edit `apps/dashboard/components/sidebar-config.ts` so chatbot / website / intake-forms entries are filtered by `useFeatureEnabled()`.

- [ ] **Step 6.4: Commit**

```bash
git add apps/dashboard/components/feature-gate.tsx apps/dashboard/hooks/use-feature-enabled.ts apps/dashboard/components/sidebar-config.ts apps/dashboard/test/feature-gate.spec.tsx
git commit -m "feat(saas-06): FeatureGate + useFeatureEnabled + sidebar gating"
```

---

## Task 7 — Tenant switcher

### 7A: Backend — `GET /me/memberships`

- [ ] **Step 7A.1: TDD handler**

Create `apps/backend/src/modules/identity/list-memberships/list-memberships.handler.spec.ts` — returns all `Membership` rows for the current user with `organization` included.

- [ ] **Step 7A.2: Implement handler** — uses `prisma.membership.findMany({ where: { userId }, include: { organization: true } })`. Since `Membership` is scoped but the caller is the user themselves, use `$allTenants.membership` OR query by `userId` under a special authorization check. Safer: use `$allTenants` and filter by `userId`.

- [ ] **Step 7A.3: Controller**

In `apps/backend/src/api/dashboard/me/me.controller.ts`:

```ts
@Get('memberships')
@UseGuards(JwtAuthGuard)
async memberships(@CurrentUser() user: { id: string }) {
  return this.list.execute({ userId: user.id });
}
```

- [ ] **Step 7A.4: Commit.**

### 7B: Backend — `POST /auth/switch-org`

- [ ] **Step 7B.1: TDD handler**

`SwitchOrganizationHandler` — verifies the user has a `Membership` in the target org; issues a new JWT with `organizationId` set to the target; returns `{ accessToken, refreshToken }`.

- [ ] **Step 7B.2: Controller**

In `apps/backend/src/api/dashboard/auth/auth.controller.ts`:

```ts
@Post('switch-org')
@UseGuards(JwtAuthGuard)
async switchOrg(@Body() dto: SwitchOrgDto, @CurrentUser() user: { id: string }) {
  return this.switch.execute({ userId: user.id, targetOrganizationId: dto.organizationId });
}
```

DTO: `{ organizationId: string }` + Zod validation.

- [ ] **Step 7B.3: Commit.**

### 7C: Frontend — `useMemberships` + `useSwitchOrganization`

- [ ] **Step 7C.1: Hooks**

Create `apps/dashboard/hooks/use-memberships.ts`:

```ts
export function useMemberships() {
  return useQuery({
    queryKey: ['me', 'memberships'],
    queryFn: () => api.get('/api/v1/me/memberships'),
    staleTime: 5 * 60 * 1000,
  });
}
```

Create `apps/dashboard/hooks/use-switch-organization.ts`:

```ts
export function useSwitchOrganization() {
  const queryClient = useQueryClient();
  const router = useRouter();
  return useMutation({
    mutationFn: (organizationId: string) =>
      api.post('/api/v1/auth/switch-org', { organizationId }),
    onSuccess: ({ accessToken, refreshToken }) => {
      // Store new tokens (same mechanism as login)
      authStorage.set({ accessToken, refreshToken });
      queryClient.clear();            // Flush ALL caches — new org, new data
      router.refresh();
    },
  });
}
```

### 7D: TenantSwitcher component

- [ ] **Step 7D.1: Write failing test**

Create `apps/dashboard/test/tenant-switcher.spec.tsx` with two memberships mocked; assert dropdown lists both; clicking the inactive one fires the mutation.

- [ ] **Step 7D.2: Implement**

```tsx
'use client';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, Button } from '@deqah/ui';
import { useTranslations } from 'next-intl';
import { useMemberships } from '@/hooks/use-memberships';
import { useSwitchOrganization } from '@/hooks/use-switch-organization';
import { useOrg } from '@/lib/org-context';

export function TenantSwitcher() {
  const t = useTranslations('nav');
  const { data: memberships } = useMemberships();
  const current = useOrg();
  const switchOrg = useSwitchOrganization();

  if (!memberships || memberships.length <= 1) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost">{current?.nameAr ?? t('selectOrg')}</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {memberships.map((m) => (
          <DropdownMenuItem
            key={m.organizationId}
            onClick={() => switchOrg.mutate(m.organizationId)}
            disabled={m.organizationId === current?.id}
          >
            {m.organization.nameAr}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

- [ ] **Step 7D.3: Mount in app shell**

Edit `apps/dashboard/app/(dashboard)/layout.tsx` — add `<TenantSwitcher />` in the top-right region of the header.

- [ ] **Step 7D.4: Commit**

```bash
git add apps/dashboard/hooks/use-memberships.ts \
        apps/dashboard/hooks/use-switch-organization.ts \
        apps/dashboard/components/tenant-switcher.tsx \
        apps/dashboard/app/\(dashboard\)/layout.tsx \
        apps/dashboard/test/tenant-switcher.spec.tsx \
        apps/backend/src/modules/identity/list-memberships/ \
        apps/backend/src/modules/identity/switch-organization/ \
        apps/backend/src/api/dashboard/me/me.controller.ts \
        apps/backend/src/api/dashboard/auth/auth.controller.ts
git commit -m "feat(saas-06): tenant switcher with org-aware JWT refresh"
```

---

## Task 8 — Billing UI

### 8A: BillingUsageWidget (sidebar)

- [ ] **Step 8A.1: Write failing test** — asserts progress bar at 42% when `bookingsThisMonth=420 / maxBookingsPerMonth=1000`.

- [ ] **Step 8A.2: Implement**

Create `apps/dashboard/components/billing-usage-widget.tsx`:

```tsx
'use client';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { Card } from '@deqah/ui';
import { useBilling } from '@/lib/billing/billing-context';

export function BillingUsageWidget() {
  const t = useTranslations('billing');
  const { plan, usage } = useBilling();
  if (!plan || !usage) return null;

  const pct = Math.min(100, Math.round((usage.bookingsThisMonth / plan.limits.maxBookingsPerMonth) * 100));
  return (
    <Card className="p-3">
      <div className="text-xs text-muted-foreground">{t('plan')}: {plan.name}</div>
      <div className="text-sm mt-2">
        {t('bookingsUsed', { used: usage.bookingsThisMonth, total: plan.limits.maxBookingsPerMonth })}
      </div>
      <div className="h-2 bg-muted rounded mt-1 overflow-hidden">
        <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
      <Link href="/settings/billing" className="text-xs text-primary mt-2 block">
        {t('manageBilling')}
      </Link>
    </Card>
  );
}
```

- [ ] **Step 8A.3: Mount in sidebar**

Add `<BillingUsageWidget />` above the sidebar footer in `apps/dashboard/app/(dashboard)/layout.tsx` (or the existing sidebar shell component).

### 8B: /settings/billing page

- [ ] **Step 8B.1: Page skeleton (≤150 lines)**

Create `apps/dashboard/app/(dashboard)/settings/billing/page.tsx`:

```tsx
'use client';
import { useTranslations } from 'next-intl';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { PageHeader } from '@/components/page-header';
import { CurrentPlanCard } from '@/components/features/billing/current-plan-card';
import { UsageTable } from '@/components/features/billing/usage-table';
import { InvoiceList } from '@/components/features/billing/invoice-list';
import { UpgradeDialog } from '@/components/features/billing/upgrade-dialog';

export default function BillingPage() {
  const t = useTranslations('billing');
  return (
    <>
      <Breadcrumbs items={[{ label: t('settings'), href: '/settings' }, { label: t('billing') }]} />
      <PageHeader
        title={t('title')}
        description={t('subtitle')}
        actions={[{ label: t('upgrade'), variant: 'default', component: <UpgradeDialog /> }]}
      />
      <CurrentPlanCard />
      <UsageTable />
      <InvoiceList />
    </>
  );
}
```

- [ ] **Step 8B.2: Feature components**

Build under `apps/dashboard/components/features/billing/`:
- `current-plan-card.tsx` — name, price, billing cycle, next renewal date.
- `usage-table.tsx` — one row per metered dimension (bookings, employees, storage).
- `invoice-list.tsx` — list past invoices with download link (uses Plan 04's invoice endpoint).
- `upgrade-dialog.tsx` — plan comparison + `POST /api/v1/dashboard/billing/change-plan`.

Each file ≤300 lines.

- [ ] **Step 8C: Commit**

```bash
git add apps/dashboard/app/\(dashboard\)/settings/billing/ \
        apps/dashboard/components/features/billing/ \
        apps/dashboard/components/billing-usage-widget.tsx \
        apps/dashboard/test/billing-usage-widget.spec.tsx
git commit -m "feat(saas-06): billing UI — usage widget + /settings/billing page"
```

---

## Task 9 — Page-by-page i18n refactor (8 categories)

For each of the 8 representative categories, follow this recipe:

**Recipe per page:**
1. Read `app/(dashboard)/<category>/page.tsx`.
2. Replace every hardcoded string with `const t = useTranslations('<category>');` + `t('<key>')`.
3. For terminology-sensitive labels (e.g. "booking" → "appointment" vs "session"), use `tTerm('booking.noun')`.
4. For plurals, use `tp()` (next-intl's `.rich` / ICU plurals).
5. Extend `ar.<category>.ts` + `en.<category>.ts` with the new keys. Parity script must stay green.
6. Run the page in both `ar` and `en` locales. Compare screenshots against the pre-refactor version.
7. Commit one category at a time.

### 9A: Bookings

- [ ] **Step 9A.1: Refactor** `app/(dashboard)/bookings/page.tsx` + `app/(dashboard)/bookings/create/page.tsx` + `components/features/bookings/**/*.tsx`.
- [ ] **Step 9A.2: Update `ar.bookings.ts` + `en.bookings.ts`.**
- [ ] **Step 9A.3: Parity check passes.**
- [ ] **Step 9A.4: Manual spot check in browser (ar + en).**
- [ ] **Step 9A.5: Commit** `feat(saas-06): bookings i18n + terminology`.

### 9B: Clients — same pattern.
### 9C: Employees — same pattern.
### 9D: Services — same pattern.
### 9E: Branches — same pattern.
### 9F: Settings — same pattern.
### 9G: Billing — same pattern (use keys authored in Task 8).
### 9H: Activity-log — same pattern.

After 9A–9H land, the remaining categories (payments, coupons, chatbot, intake-forms, invoices, ratings, notifications, branding, zatca, users) follow the same recipe in subsequent commits. Track them via the Task 1 checklist.

---

## Task 10 — i18n snapshot test

- [ ] **Step 10.1: Write the test**

Create `apps/dashboard/test/i18n-snapshot.spec.tsx`:

```tsx
import { render } from '@testing-library/react';
import { glob } from 'glob';
import path from 'node:path';

describe('i18n snapshot — no untranslated literals', () => {
  const pages = glob.sync('app/(dashboard)/**/page.tsx', { cwd: path.resolve(__dirname, '..') });

  for (const pagePath of pages) {
    it(`${pagePath} has no AR literal outside t()`, async () => {
      const source = await fs.readFile(path.resolve(__dirname, '..', pagePath), 'utf8');
      // Strip imports + comments + t()/tp()/tTerm() expressions
      const stripped = source
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*$/gm, '')
        .replace(/t\([^)]+\)/g, '')
        .replace(/tp\([^)]+\)/g, '')
        .replace(/tTerm\([^)]+\)/g, '');
      const arLiteral = stripped.match(/[؀-ۿ]+/);
      expect(arLiteral, `${pagePath} contains AR literal: ${arLiteral?.[0]}`).toBeNull();
    });
  }
});
```

- [ ] **Step 10.2: Run**

```bash
cd apps/dashboard && npm run test -- i18n-snapshot
```

Expected: any remaining hardcoded AR literal causes a failure. Iterate Task 9 until green.

- [ ] **Step 10.3: Commit**

```bash
git add apps/dashboard/test/i18n-snapshot.spec.tsx
git commit -m "test(saas-06): i18n snapshot forbids AR literals outside t()"
```

---

## Task 11 — Update dashboard CLAUDE.md

- [ ] **Step 11.1: Append section**

Edit `apps/dashboard/CLAUDE.md` — append:

```markdown
## i18n + terminology + gating (SaaS-06)

- Every user-facing string goes through `useTranslations('<namespace>')` → `t('<key>')`.
- Plurals via ICU in next-intl (`t.rich` / `t(...)` with `{count, plural, one {…} other {…}}`).
- Vertical-aware strings via `useTerminology('<key>')` / `tTerm('<key>')`.
- Feature visibility gated by `<FeatureGate feature="…" fallback={…}>` or `useFeatureEnabled(...)`.
- Direction flips automatically via `<DirectionProvider>` — use logical Tailwind classes, never `left`/`right`.
- Tenant switcher shows only when `useMemberships()` returns > 1 row.
- Parity: `npm run i18n:verify` must exit 0 before PR.
- i18n snapshot test: any AR literal outside `t()/tp()/tTerm()` fails the build.
```

- [ ] **Step 11.2: Add to Pre-PR checklist** (`i18n:verify` + snapshot test).

- [ ] **Step 11.3: Commit**

```bash
git add apps/dashboard/CLAUDE.md
git commit -m "docs(saas-06): dashboard CLAUDE.md i18n + gating section"
```

---

## Task 12 — QA gate (Chrome DevTools MCP + Kiwi sync)

### 12A: Chrome DevTools MCP — 3 representative pages × 2 locales

- [ ] **Step 12A.1: Boot apps**

```bash
npm run dev:backend & npm run dev:dashboard
```

- [ ] **Step 12A.2: For each of {bookings list, services list, /settings/billing} and each locale {ar, en}:**

Via Chrome DevTools MCP:
1. Navigate to `http://localhost:5103/<path>?locale=<ar|en>`.
2. `take_snapshot` — verify no missing-translation warnings in the console.
3. `list_console_messages` — there MUST be zero `[next-intl] MISSING_MESSAGE` errors.
4. `take_screenshot` — attach to QA report.
5. `lighthouse_audit` on at least one page per locale — confirm A11y score ≥ 95.

Record outputs in `docs/superpowers/qa/saas-06-report-<date>.md`.

### 12B: Kiwi sync

- [ ] **Step 12B.1: Author `data/kiwi/dashboard-i18n-<date>.json`**

```json
{
  "domain": "dashboard-i18n",
  "version": "main",
  "build": "manual-qa-<date>",
  "planName": "Deqah / Dashboard / Manual QA",
  "planSummary": "SaaS-06 dashboard terminology + EN i18n QA",
  "runSummary": "Verified 3 pages × 2 locales; 0 missing-translation console warnings",
  "cases": [
    { "summary": "Bookings list renders in Arabic with RTL layout", "text": "…", "result": "pass" },
    { "summary": "Bookings list renders in English with LTR layout", "text": "…", "result": "pass" },
    { "summary": "Services list renders in Arabic with RTL layout", "text": "…", "result": "pass" },
    { "summary": "Services list renders in English with LTR layout", "text": "…", "result": "pass" },
    { "summary": "/settings/billing renders in Arabic with RTL layout", "text": "…", "result": "pass" },
    { "summary": "/settings/billing renders in English with LTR layout", "text": "…", "result": "pass" },
    { "summary": "Tenant switcher hides when user has 1 org, shows when >1", "text": "…", "result": "pass" },
    { "summary": "FeatureGate hides chatbot sidebar entry when plan has chatbotEnabled=false", "text": "…", "result": "pass" }
  ]
}
```

- [ ] **Step 12B.2: Sync**

```bash
npm run kiwi:sync-manual data/kiwi/dashboard-i18n-<date>.json
```

- [ ] **Step 12B.3: Link Kiwi URLs into the QA report.**

- [ ] **Step 12B.4: Commit QA assets**

```bash
git add docs/superpowers/qa/saas-06-report-*.md data/kiwi/dashboard-i18n-*.json
git commit -m "qa(saas-06): chrome-devtools + kiwi manual-QA gate"
```

---

## Task 13 — Final verification + PR

- [ ] **Step 13.1: Full monorepo tests**

```bash
cd /Users/tariq/code/deqah && npm run test && npm run typecheck && npm run build
```

Expected: all green.

- [ ] **Step 13.2: i18n parity + snapshot**

```bash
cd apps/dashboard && npm run i18n:verify && npm run test -- i18n-snapshot
```

Expected: exit 0, zero failures.

- [ ] **Step 13.3: Open PR**

```bash
gh pr create \
  --base main \
  --head feat/saas-06-dashboard-i18n \
  --title "feat(saas-06): dashboard terminology + EN i18n + tenant switcher + billing UI" \
  --body "$(cat <<'EOF'
## Summary
- Full t()/tp()/tTerm() refactor across 8+ dashboard categories
- English translation parity + verify script
- DirectionProvider for locale-aware RTL/LTR
- useTerminology hook (vertical-aware labels)
- FeatureGate + useFeatureEnabled (plan-limit-driven visibility)
- TenantSwitcher (multi-org users)
- /settings/billing page + sidebar usage widget
- Backend: GET /me/memberships + POST /auth/switch-org

## Test plan
- [x] Parity script exit 0
- [x] i18n snapshot forbids AR literals outside t()
- [x] Vitest: DirectionProvider, useTerminology, FeatureGate, TenantSwitcher, BillingUsageWidget
- [x] Chrome DevTools MCP: 3 pages × 2 locales, 0 missing-translation errors
- [x] Kiwi sync: plan Deqah / Dashboard / Manual QA updated

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 13.4: Memory file**

Create `/Users/tariq/.claude/projects/-Users-tariq-code-deqah/memory/saas06_status.md`:

```markdown
---
name: SaaS-06 status
description: Plan 06 (dashboard terminology + EN i18n) — status and key facts
type: project
---
**Status:** [fill in: PR number, test count, pages refactored, any divergences]

**Scope delivered:** full t()/tp()/tTerm() across the dashboard; EN parity complete; RTL/LTR toggle; terminology hook; feature gating; tenant switcher; billing UI (widget + /settings/billing).

**Patterns established:**
- useTerminology(key) for vertical-aware labels
- <FeatureGate feature="…"> + useFeatureEnabled
- TenantSwitcher + POST /auth/switch-org
- i18n parity script + snapshot test as pre-PR gates

**Next:** Plan 07 (marketing site + signup wizard)
```

- [ ] **Step 13.5: Update transformation index**

Edit `docs/superpowers/plans/2026-04-21-saas-transformation-index.md`:
- Phase map row 06 → `✅ DONE (<date>)` with PR link.
- Progress log new row.
- Status dashboard counts + next-action updated.

---

## Amendments applied during execution

### 2026-04-22 — Execution divergence log (session 1)

**Reality check against the plan's assumptions:**

1. **Dashboard does NOT use `next-intl` at runtime.** Although `next-intl@4.8.3`
   is installed, `apps/dashboard/components/locale-provider.tsx` is the sole
   i18n runtime: a `LocaleProvider` context with `useLocale()` → flat
   `t(key: string)` backed by `lib/translations.ts` (which merges
   `lib/translations/ar.*.ts` / `en.*.ts` into two `Record<string, string>`s).
   → **Plan steps referencing `useTranslations('<namespace>')`, ICU
   `.rich` plurals, next-intl `onError` / `getMessageFallback`, and
   `NextIntlClientProvider` in test wrappers do not apply as written.** We
   keep the existing custom system and adapt the gate (parity script +
   snapshot test) to the flat-key model.

2. **`DirectionProvider` is already wired** inside `LocaleProvider` via
   `@radix-ui/react-direction` (flips `rtl`/`ltr` with locale, syncs
   `document.documentElement.dir`). Plan Task 3 as a new file is
   redundant; keep current wiring. (Root `app/layout.tsx` still hardcodes
   `dir="rtl"` on `<html>` as the SSR default, which is fine — the
   client `LocaleProvider` overrides at mount.)

3. **`useTerminology` already exists** at
   `apps/dashboard/hooks/use-terminology.ts` (Plan 03, shipped). Signature
   differs from plan: it is `useTerminology(verticalSlug: string)` →
   `{ t(key), isLoading, pack }`, queries
   `GET /public/verticals/:slug/terminology`. It returns `string | key`
   (fallback to key), not a typed `TerminologyKey` union. Plan Task 4 as
   written would create a second, conflicting hook → we keep the shipped
   one and treat Task 4 as DONE.

4. **`OrgContext` does not exist** in the dashboard — instead, vertical
   slug would need to come from `AuthProvider` / `BrandingProvider`. Per
   `hooks/use-terminology.ts` comment: "the current auth session
   (AuthUser) and OrganizationSettings do not yet carry the vertical slug
   — this will be populated in Plan 07." → Task 4.3's `OrgContext.Provider`
   wrapper is not applicable.

5. **i18n audit volume (Task 1).** `grep '[؀-ۿ]'` over `app/` + `components/`
   returns **434 Arabic literal occurrences across 65 files**. A full
   refactor of the 8 representative categories under the Plan 06
   session budget is not realistic in a single agent session, so Task 9
   (A–H page refactors) is explicitly **deferred to a follow-up plan**
   (tentative: 06a). Audit outputs written to
   `apps/dashboard/.i18n-audit/` (git-ignored) for handoff.

6. **Plan 04 dependency.** Tasks 5 (BillingContext / useCurrentPlan),
   6 (FeatureGate), 8 (Billing UI), and 9G (Billing category i18n) are
   blocked by Plan 04 endpoints and types, which are NOT yet on `main`.
   Per the launch instructions, we **stop before those tasks** and do
   not stub the Plan-04 types (to avoid merge pain).

**Consequently this session delivers only:**
- Task 1 partial — audit scratch scaffolding + `.gitignore`.
- Task 2 — EN/AR parity script, `i18n:verify` npm script, 2 AR keys
  added so parity is 0/0 (green).
- Task 7A/B — backend `GET /me/memberships` + `POST /auth/switch-org`.
- Task 7C/D — frontend tenant switcher + hooks.
- Task 11 — dashboard `CLAUDE.md` addendum documenting the actual
  (custom-LocaleProvider) system.

**Deferred to follow-up plan(s):** Tasks 3 (redundant), 4 (already shipped),
5, 6, 8, 9A–9H, 10 (snapshot test), 12 (Chrome DevTools + Kiwi QA),
13.3 (PR).

