# SaaS-08 — Website Multi-tenant + Vertical Themes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Refactor `apps/website/` from a single-tenant (sawaa-only) Next.js app into a multi-tenant engine that serves many orgs on many hostnames: (a) `Host` header → slug resolution → org + theme + vertical, (b) 4 vertical theme families (medical / consulting / salon / fitness) × 4 visual families (mint / ocean / sand / royal) combined at render, (c) bilingual SEO (AR + EN URLs + hreflang + structured data per-vertical), (d) conditional routing (embed-only tenants, custom-domain-pending, suspended), (e) embeddable booking widget at `widget.js` for Starter-tier tenants.

**Architecture:** `middleware.ts` reads `Host` header → resolves slug from `{slug}.deqah.app` OR custom domain (via Plan 09's `CustomDomain` table) → fetches `GET /api/v1/public/site-settings?slug=X` (short-TTL cached) → sets request headers `x-organization-id`, `x-vertical`, `x-visual-theme`, `x-website-enabled` → layout reads these via `headers()` and picks the right theme composition. Themes are restructured from the current `themes/{sawaa,premium}/` to `themes/visual/{mint,ocean,sand,royal}/` + `themes/vertical/{medical,consulting,salon,fitness}/`, combined at render time (vertical provides content shape; visual provides palette + typography + spacing).

**Tech Stack:** Next.js 15 App Router, React 19, Tailwind 4, `@deqah/ui`, `@deqah/shared`, `@deqah/api-client`, next-intl, esbuild (for widget bundle), Vitest, Chrome DevTools MCP for manual QA.

---

## Critical lessons carried forward

1. **SiteSetting is per-org singleton** (02g). Fetch via `GET /api/v1/public/site-settings?slug=X` — this endpoint must exist (create it in Task 2) and return `{ organizationId, websiteEnabled, verticalSlug, visualThemeSlug, defaultLocale, status, customDomainStatus }`.
2. **Middleware cannot touch the DB.** Next.js Edge runtime disallows Prisma. Use `fetch` + short in-memory cache with SWR semantics (5 min TTL) or a Redis KV if we ship one — for this plan, `fetch` + `unstable_cache` is sufficient.
3. **RTL-first layout** per root CLAUDE.md — vertical themes use logical properties (`ps-/pe-`, `start-/end-`). No hardcoded `left`/`right`.
4. **Semantic tokens only** — all colors through CSS custom properties, overridable per-org via `BrandingConfig`.
5. **Starter tier is embed-only.** `siteSettings.websiteEnabled === false` → render a branded "this clinic is embed-only — use our widget" placeholder instead of the full site.
6. **sawaa becomes the "consulting" vertical reference implementation** — the refactor preserves sawaa's current look as the `consulting × mint` combination, so sawaa continues rendering identically after the change.

---

## File Structure

### Restructured themes — `apps/website/themes/`

| Before | After |
|---|---|
| `themes/sawaa/` | DELETED (content migrated to `vertical/consulting/` + `visual/mint/`) |
| `themes/premium/` | DELETED (content migrated to `vertical/consulting/` + `visual/royal/`) |
| — | `themes/visual/mint/tokens.css` + `tokens.ts` |
| — | `themes/visual/ocean/tokens.css` + `tokens.ts` |
| — | `themes/visual/sand/tokens.css` + `tokens.ts` |
| — | `themes/visual/royal/tokens.css` + `tokens.ts` |
| — | `themes/vertical/medical/pages/*.tsx` + `components/sections/*.tsx` + `layout/layout.tsx` |
| — | `themes/vertical/consulting/pages/*.tsx` + `components/sections/*.tsx` + `layout/layout.tsx` (migrated from sawaa) |
| — | `themes/vertical/salon/pages/*.tsx` + `components/sections/*.tsx` + `layout/layout.tsx` |
| — | `themes/vertical/fitness/pages/*.tsx` + `components/sections/*.tsx` + `layout/layout.tsx` |
| — | `themes/resolve-theme.ts` — combines (vertical, visual) → `{ Layout, pages }` |
| `themes/registry.ts` | REWRITTEN — exports resolver + type mapping |
| `themes/types.ts` | UPDATED to new theme shape |

### New files — `apps/website/`

| Path | Responsibility |
|---|---|
| `apps/website/middleware.ts` | Host → slug → siteSettings → header injection |
| `apps/website/lib/tenant-context.ts` | Server-side helpers reading injected headers |
| `apps/website/lib/site-settings-client.ts` | Cached fetcher for `/api/v1/public/site-settings` |
| `apps/website/app/[locale]/layout.tsx` | Wraps existing routes with `locale` segment + direction |
| `apps/website/app/[locale]/widget/book/page.tsx` | Minimal booking iframe for embed widget |
| `apps/website/app/[locale]/_unavailable/embed-only.tsx` | Starter-tier placeholder |
| `apps/website/app/[locale]/_unavailable/pending-verification.tsx` | Custom domain pending |
| `apps/website/app/[locale]/_unavailable/suspended.tsx` | Suspended tenant |
| `apps/website/app/sitemap.ts` | Rewritten — per-tenant sitemap via Host |
| `apps/website/app/robots.ts` | Rewritten — per-tenant |

### New files — `apps/landing/` (widget bundle)

| Path | Responsibility |
|---|---|
| `apps/landing/public/widget.js` | BUILT output (not committed source — see `widget-src/`) |
| `apps/landing/widget-src/widget.ts` | Tiny loader (~3KB) that injects iframe |
| `apps/landing/widget-src/build.ts` | esbuild script |
| `apps/landing/package.json` | Add `build:widget` script |

### Backend additions — `apps/backend/`

| Path | Responsibility |
|---|---|
| `src/api/public/site-settings/site-settings.controller.ts` | `GET /api/v1/public/site-settings?slug=X` |
| `src/api/public/widget/widget-track.controller.ts` | `POST /api/v1/public/widget/track` analytics |
| `src/modules/platform/public/get-site-settings.handler.ts` | Read-only query joining Org + SiteSetting + Vertical + CustomDomain |
| `test/e2e/website/site-settings.e2e-spec.ts` | Contract test for the endpoint |

### Tests

| Path | Responsibility |
|---|---|
| `apps/website/__tests__/tenant-resolver.test.ts` | Host parsing (subdomain + custom domain) |
| `apps/website/__tests__/theme-resolver.test.ts` | `resolveTheme(vertical, visual)` correctness |
| `apps/website/__tests__/middleware.test.ts` | Header injection logic |
| `apps/website/__tests__/seo.snapshot.test.ts` | hreflang + sitemap + structured data snapshots |
| `apps/website/__tests__/widget-integration.test.ts` | Widget loads iframe with correct src |

### Modified files

- `apps/website/themes/registry.ts` — full rewrite
- `apps/website/app/layout.tsx` — thins down; delegates to `[locale]/layout.tsx`
- All `apps/website/app/*/page.tsx` → move under `app/[locale]/...`
- `packages/shared/src/enums.ts` — add `VerticalTheme` (MEDICAL/CONSULTING/SALON/FITNESS) and `VisualTheme` (MINT/OCEAN/SAND/ROYAL). Deprecate legacy `WebsiteTheme` enum.
- `packages/api-client/src/endpoints/public.ts` — add `getSiteSettings(slug)` + `trackWidget()` helpers
- Root `CLAUDE.md` — update Structure / domains note

---

## Task 1 — Backend: `GET /api/v1/public/site-settings?slug=X`

- [ ] **Step 1.1: Contract**

Response shape:
```ts
{
  organizationId: string;
  slug: string;
  nameAr: string;
  nameEn: string;
  status: 'ACTIVE' | 'SUSPENDED';
  websiteEnabled: boolean;
  verticalSlug: 'medical' | 'consulting' | 'salon' | 'fitness';
  visualThemeSlug: 'mint' | 'ocean' | 'sand' | 'royal';
  defaultLocale: 'ar' | 'en';
  customDomainStatus: 'NONE' | 'PENDING' | 'VERIFYING' | 'ACTIVE' | 'FAILED';
  customDomainHostname: string | null;
  branding: { primaryColor: string; logoUrl: string | null };
}
```

- [ ] **Step 1.2: Write e2e test first**

Create `apps/backend/test/e2e/website/site-settings.e2e-spec.ts`:

```ts
describe('GET /api/v1/public/site-settings', () => {
  it('returns settings for an active org by slug', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/public/site-settings?slug=test-clinic-08')
      .expect(200);
    expect(res.body.slug).toBe('test-clinic-08');
    expect(res.body.verticalSlug).toMatch(/^(medical|consulting|salon|fitness)$/);
  });
  it('returns 404 for unknown slug', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/public/site-settings?slug=does-not-exist')
      .expect(404);
  });
  it('returns suspended status for suspended org', async () => {
    // seed a suspended org
    const res = await request(app.getHttpServer())
      .get('/api/v1/public/site-settings?slug=suspended-clinic-08')
      .expect(200);
    expect(res.body.status).toBe('SUSPENDED');
  });
});
```

- [ ] **Step 1.3: Implement handler**

Create `apps/backend/src/modules/platform/public/get-site-settings.handler.ts`:

```ts
@Injectable()
export class GetSiteSettingsHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(slug: string) {
    const org = await this.prisma.organization.findUnique({
      where: { slug },
      include: {
        vertical: true,
        siteSetting: true,
        brandingConfig: true,
        customDomain: true,
      },
    });
    if (!org) throw new NotFoundException();

    return {
      organizationId: org.id,
      slug: org.slug,
      nameAr: org.nameAr,
      nameEn: org.nameEn,
      status: org.status,
      websiteEnabled: org.siteSetting?.websiteEnabled ?? false,
      verticalSlug: org.vertical.templateFamily, // 'medical'|'consulting'|'salon'|'fitness'
      visualThemeSlug: org.siteSetting?.visualTheme ?? 'mint',
      defaultLocale: org.siteSetting?.defaultLocale ?? 'ar',
      customDomainStatus: org.customDomain?.status ?? 'NONE',
      customDomainHostname: org.customDomain?.hostname ?? null,
      branding: {
        primaryColor: org.brandingConfig?.primaryColor ?? '#354FD8',
        logoUrl: org.brandingConfig?.logoUrl ?? null,
      },
    };
  }
}
```

Note: `Organization.findUnique({ where: { slug } })` runs in unauthenticated context — `Organization` is NOT in SCOPED_MODELS, so no tenant injection. But the `include`d scoped models (`siteSetting`, `brandingConfig`) will be Proxy-scoped — that's the WRONG behavior for a public read. Solution: either (a) use `$queryRaw` with explicit joins, or (b) bypass the Proxy via `this.prisma.$unextended()` if that method exists, or (c) fetch Organization first, then fetch children with explicit `where: { organizationId: org.id }` — the extension will merge the where but since we're providing it explicitly, the result is correct.

**Recommended:** option (c). Two-step fetch. Document in the handler why.

- [ ] **Step 1.4: Controller**

`GET /api/v1/public/site-settings?slug=X` — throttled (60 req/min/IP).

- [ ] **Step 1.5: Run tests**

```bash
cd apps/backend && npm run test:e2e -- website/site-settings
```

- [ ] **Step 1.6: Commit**

```bash
git add apps/backend/src/modules/platform/public/get-site-settings.handler.ts \
        apps/backend/src/api/public/site-settings \
        apps/backend/test/e2e/website/site-settings.e2e-spec.ts
git commit -m "feat(saas-08): GET /api/v1/public/site-settings"
```

---

## Task 2 — Website: tenant resolver + middleware

- [ ] **Step 2.1: Write tests first**

Create `apps/website/__tests__/tenant-resolver.test.ts`:

```ts
import { resolveSlugFromHost } from '../lib/tenant-resolver';

describe('resolveSlugFromHost', () => {
  it('extracts slug from {slug}.deqah.app', () => {
    expect(resolveSlugFromHost('clinic-one.deqah.app')).toEqual({ kind: 'subdomain', slug: 'clinic-one' });
  });
  it('returns marketing marker for root', () => {
    expect(resolveSlugFromHost('deqah.app')).toEqual({ kind: 'root' });
    expect(resolveSlugFromHost('www.deqah.app')).toEqual({ kind: 'root' });
  });
  it('flags custom domain', () => {
    expect(resolveSlugFromHost('clinic.com')).toEqual({ kind: 'custom', hostname: 'clinic.com' });
  });
  it('handles dev localhost', () => {
    expect(resolveSlugFromHost('clinic-one.localhost:5104')).toEqual({ kind: 'subdomain', slug: 'clinic-one' });
  });
});
```

- [ ] **Step 2.2: Implement resolver**

Create `apps/website/lib/tenant-resolver.ts`:

```ts
type Resolved =
  | { kind: 'subdomain'; slug: string }
  | { kind: 'custom'; hostname: string }
  | { kind: 'root' };

const ROOT_HOSTS = new Set(['deqah.app', 'www.deqah.app']);
const DEV_ROOT = ['localhost', '127.0.0.1'];

export function resolveSlugFromHost(host: string): Resolved {
  const [h] = host.split(':');
  if (ROOT_HOSTS.has(h)) return { kind: 'root' };

  if (h.endsWith('.deqah.app')) {
    const slug = h.slice(0, -'.deqah.app'.length);
    return { kind: 'subdomain', slug };
  }
  if (h.endsWith('.localhost')) {
    const slug = h.slice(0, -'.localhost'.length);
    return { kind: 'subdomain', slug };
  }
  if (DEV_ROOT.includes(h)) return { kind: 'root' };

  return { kind: 'custom', hostname: h };
}
```

- [ ] **Step 2.3: Implement cached site-settings fetcher**

Create `apps/website/lib/site-settings-client.ts`:

```ts
import { unstable_cache } from 'next/cache';

export type SiteSettings = { /* mirror backend response */ };

const ENDPOINT = process.env.BACKEND_URL ?? 'http://localhost:5100';

export const getSiteSettingsBySlug = unstable_cache(
  async (slug: string): Promise<SiteSettings | null> => {
    const res = await fetch(`${ENDPOINT}/api/v1/public/site-settings?slug=${slug}`, {
      headers: { accept: 'application/json' },
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`site-settings fetch failed: ${res.status}`);
    return res.json();
  },
  ['site-settings-by-slug'],
  { revalidate: 300, tags: ['site-settings'] },
);

export const getSiteSettingsByHostname = unstable_cache(
  async (hostname: string): Promise<SiteSettings | null> => {
    const res = await fetch(`${ENDPOINT}/api/v1/public/site-settings?hostname=${hostname}`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`site-settings fetch failed: ${res.status}`);
    return res.json();
  },
  ['site-settings-by-hostname'],
  { revalidate: 300, tags: ['site-settings'] },
);
```

The backend endpoint must accept both `slug` and `hostname` query params — extend it in Task 1.4 if not already done.

- [ ] **Step 2.4: Implement middleware**

Create `apps/website/middleware.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { resolveSlugFromHost } from './lib/tenant-resolver';

export async function middleware(req: NextRequest) {
  const host = req.headers.get('host') ?? '';
  const resolved = resolveSlugFromHost(host);

  if (resolved.kind === 'root') {
    // Shouldn't happen — deqah.app is served by apps/landing.
    return NextResponse.redirect('https://deqah.app');
  }

  // Fetch via Edge-safe HTTP (no Prisma).
  const backend = process.env.BACKEND_URL ?? 'http://localhost:5100';
  const url = resolved.kind === 'subdomain'
    ? `${backend}/api/v1/public/site-settings?slug=${resolved.slug}`
    : `${backend}/api/v1/public/site-settings?hostname=${resolved.hostname}`;

  const res = await fetch(url);
  if (res.status === 404) {
    return new NextResponse('Not found', { status: 404 });
  }
  const settings = await res.json();

  const response = NextResponse.next();
  response.headers.set('x-organization-id', settings.organizationId);
  response.headers.set('x-org-slug', settings.slug);
  response.headers.set('x-vertical', settings.verticalSlug);
  response.headers.set('x-visual-theme', settings.visualThemeSlug);
  response.headers.set('x-website-enabled', String(settings.websiteEnabled));
  response.headers.set('x-org-status', settings.status);
  response.headers.set('x-custom-domain-status', settings.customDomainStatus);
  response.headers.set('x-default-locale', settings.defaultLocale);
  response.headers.set('x-primary-color', settings.branding.primaryColor);
  return response;
}

export const config = {
  matcher: ['/((?!_next|api|widget.js|favicon.ico).*)'],
};
```

- [ ] **Step 2.5: Run resolver + middleware tests**

```bash
npm run test --workspace=@deqah/website
```

Expected: tenant-resolver + middleware tests pass.

- [ ] **Step 2.6: Commit**

```bash
git add apps/website/lib apps/website/middleware.ts apps/website/__tests__
git commit -m "feat(saas-08): host-based tenant resolver + middleware"
```

---

## Task 3 — Theme restructure: visual families

- [ ] **Step 3.1: Create 4 visual token files**

For each of `mint`, `ocean`, `sand`, `royal`:

Create `apps/website/themes/visual/<name>/tokens.css`:

```css
[data-visual="mint"] {
  --color-surface: 250 253 252;
  --color-primary: 52 160 138;
  --color-accent: 116 201 184;
  --radius-lg: 1rem;
  --font-display: 'IBM Plex Sans Arabic', system-ui, sans-serif;
  /* …8 more tokens per visual */
}
```

(royal → gold + deep navy; sand → warm cream + terracotta; ocean → blue + teal; mint → retain sawaa's current palette exactly, so sawaa output is unchanged.)

Create `apps/website/themes/visual/<name>/tokens.ts` exporting the same values as a constant for SSR use.

- [ ] **Step 3.2: Commit**

```bash
git add apps/website/themes/visual
git commit -m "feat(saas-08): 4 visual theme token files (mint/ocean/sand/royal)"
```

---

## Task 4 — Theme restructure: vertical families

- [ ] **Step 4.1: Migrate sawaa → consulting**

```bash
cd apps/website/themes
mkdir -p vertical/consulting
cp -R sawaa/pages vertical/consulting/pages
cp -R sawaa/components vertical/consulting/components
cp -R sawaa/layout vertical/consulting/layout
cp -R sawaa/lib vertical/consulting/lib
# Do NOT migrate theme.css — visual families now own color tokens.
```

Do a find-replace inside `vertical/consulting/**` to rename:
- `Sawaa*` prefixed identifiers → `Consulting*` (e.g., `SawaaHomePage` → `ConsultingHomePage`).
- Any `theme.css` imports → remove (visual tokens are loaded via the Layout now).
- Hardcoded color references (hex literals) → CSS custom property references (`var(--color-primary)` etc.).

Run:

```bash
cd apps/website/themes/vertical/consulting
grep -rn "#[0-9a-fA-F]\{3,6\}" . | wc -l
```

Expected: 0 (or only alpha-channel utilities). Any remaining hex values must be converted to tokens.

- [ ] **Step 4.2: Create medical vertical**

Copy `consulting/` as a starting point, then adapt content:
- Hero: medical terminology ("احجز موعدك الطبي / Book your medical appointment").
- Sections: services → medical-specialty grid; team → "doctors" not "therapists"; remove burnout-test, support-groups (consulting-specific); add `/insurance` placeholder page.
- Structured data `@type: Dentist` or generic `MedicalBusiness` per vertical subtype.

- [ ] **Step 4.3: Create salon vertical**

Adapt for beauty salons: team → "stylists", services → service-cards with before/after imagery. Structured data `@type: HairSalon`.

- [ ] **Step 4.4: Create fitness vertical**

Adapt for gyms/training: team → "trainers", services → class schedules. Structured data `@type: HealthClub`.

- [ ] **Step 4.5: Delete legacy sawaa + premium**

```bash
git rm -r apps/website/themes/sawaa apps/website/themes/premium
```

- [ ] **Step 4.6: Commit per vertical**

```bash
git add apps/website/themes/vertical/consulting
git commit -m "feat(saas-08): migrate sawaa → themes/vertical/consulting"
git add apps/website/themes/vertical/medical
git commit -m "feat(saas-08): medical vertical theme"
git add apps/website/themes/vertical/salon
git commit -m "feat(saas-08): salon vertical theme"
git add apps/website/themes/vertical/fitness
git commit -m "feat(saas-08): fitness vertical theme"
git add apps/website/themes/sawaa apps/website/themes/premium
git commit -m "chore(saas-08): remove legacy sawaa/premium theme folders"
```

---

## Task 5 — Theme resolver + registry rewrite

- [ ] **Step 5.1: Write resolver test**

Create `apps/website/__tests__/theme-resolver.test.ts`:

```ts
import { resolveTheme } from '../themes/resolve-theme';

describe('resolveTheme', () => {
  it('combines consulting + mint (sawaa equivalent)', () => {
    const { Layout, pages, visualTokens } = resolveTheme('consulting', 'mint');
    expect(Layout).toBeDefined();
    expect(pages.home).toBeDefined();
    expect(visualTokens['--color-primary']).toBe('52 160 138');
  });
  it('supports all 16 combinations', () => {
    const verticals = ['medical', 'consulting', 'salon', 'fitness'] as const;
    const visuals = ['mint', 'ocean', 'sand', 'royal'] as const;
    for (const v of verticals) for (const s of visuals) {
      expect(() => resolveTheme(v, s)).not.toThrow();
    }
  });
});
```

- [ ] **Step 5.2: Implement resolver**

Create `apps/website/themes/resolve-theme.ts`:

```ts
import { ConsultingLayout } from './vertical/consulting/layout/layout';
// …imports for all 4 verticals' Layouts + pages
import { mintTokens, oceanTokens, sandTokens, royalTokens } from './visual';

const verticalTable = {
  medical: { Layout: MedicalLayout, pages: medicalPages },
  consulting: { Layout: ConsultingLayout, pages: consultingPages },
  salon: { Layout: SalonLayout, pages: salonPages },
  fitness: { Layout: FitnessLayout, pages: fitnessPages },
};

const visualTable = {
  mint: mintTokens,
  ocean: oceanTokens,
  sand: sandTokens,
  royal: royalTokens,
};

export function resolveTheme(vertical: keyof typeof verticalTable, visual: keyof typeof visualTable) {
  const v = verticalTable[vertical];
  const tokens = visualTable[visual];
  return { Layout: v.Layout, pages: v.pages, visualTokens: tokens, verticalSlug: vertical, visualSlug: visual };
}
```

- [ ] **Step 5.3: Rewrite `themes/registry.ts`**

Becomes a thin re-export wrapper around `resolve-theme.ts`. Remove the legacy `WebsiteTheme` enum import.

- [ ] **Step 5.4: Run**

```bash
npm run test --workspace=@deqah/website
```

- [ ] **Step 5.5: Commit**

```bash
git add apps/website/themes/resolve-theme.ts apps/website/themes/registry.ts apps/website/__tests__
git commit -m "feat(saas-08): theme resolver — vertical × visual composition"
```

---

## Task 6 — Wire theme into the app layout

- [ ] **Step 6.1: Add `[locale]` segment**

Migrate all routes from `apps/website/app/*/page.tsx` to `apps/website/app/[locale]/*/page.tsx`. Use `git mv` to preserve history:

```bash
cd apps/website/app
mkdir "[locale]"
git mv account booking burnout-test contact forgot-password login register reset-password support-groups therapists page.tsx "[locale]/"
```

- [ ] **Step 6.2: Create `app/[locale]/layout.tsx`**

```tsx
import { headers } from 'next/headers';
import { resolveTheme } from '../../themes/resolve-theme';
import { EmbedOnlyPlaceholder } from './_unavailable/embed-only';
import { SuspendedPlaceholder } from './_unavailable/suspended';
import { PendingVerificationPlaceholder } from './_unavailable/pending-verification';

export default async function LocaleLayout({ children, params }: { children: React.ReactNode; params: { locale: 'ar' | 'en' } }) {
  const h = await headers();
  const status = h.get('x-org-status') ?? 'ACTIVE';
  const websiteEnabled = h.get('x-website-enabled') === 'true';
  const customDomainStatus = h.get('x-custom-domain-status') ?? 'NONE';
  const vertical = (h.get('x-vertical') ?? 'consulting') as 'medical' | 'consulting' | 'salon' | 'fitness';
  const visual = (h.get('x-visual-theme') ?? 'mint') as 'mint' | 'ocean' | 'sand' | 'royal';
  const primaryColor = h.get('x-primary-color') ?? undefined;

  if (status === 'SUSPENDED') return <SuspendedPlaceholder />;
  if (!websiteEnabled) return <EmbedOnlyPlaceholder />;
  if (customDomainStatus === 'PENDING' || customDomainStatus === 'VERIFYING') return <PendingVerificationPlaceholder />;

  const { Layout, visualTokens } = resolveTheme(vertical, visual);
  const tokenStyle = Object.entries(visualTokens).map(([k, v]) => `${k}:${v}`).join(';')
    + (primaryColor ? `;--color-primary-override:${primaryColor}` : '');

  return (
    <html lang={params.locale} dir={params.locale === 'ar' ? 'rtl' : 'ltr'}>
      <body style={{ cssText: tokenStyle } as any} data-visual={visual} data-vertical={vertical}>
        <Layout locale={params.locale}>{children}</Layout>
      </body>
    </html>
  );
}
```

- [ ] **Step 6.3: Update each page.tsx to import from `resolveTheme().pages`**

Each `app/[locale]/therapists/page.tsx` etc. reads vertical from header, resolves theme, and renders `pages.therapists` (or equivalent).

- [ ] **Step 6.4: Commit**

```bash
git add apps/website/app
git commit -m "feat(saas-08): [locale] segment + header-driven theme layout"
```

---

## Task 7 — Conditional routing placeholders

- [ ] **Step 7.1: Create `_unavailable/embed-only.tsx`**

Renders a centered card: "هذا المزود يستخدم أداة الحجز المضمنة / This provider uses the embed widget only" + instructions for site owners to use `<script src="https://deqah.app/widget.js" data-org="slug">`.

- [ ] **Step 7.2: Create `_unavailable/suspended.tsx`**

"الحساب غير نشط حاليًا / This account is not currently active."

- [ ] **Step 7.3: Create `_unavailable/pending-verification.tsx`**

"جاري التحقق من النطاق / Setup in progress — your clinic's domain is being verified."

- [ ] **Step 7.4: Commit**

```bash
git add apps/website/app/[locale]/_unavailable
git commit -m "feat(saas-08): conditional routing placeholders (embed-only, suspended, pending)"
```

---

## Task 8 — Bilingual SEO (hreflang + sitemap + structured data)

- [ ] **Step 8.1: Rewrite `app/sitemap.ts`**

Per-tenant sitemap driven by the Host header. Reads org from settings, enumerates known routes, emits AR + EN alternates for each.

```ts
import { MetadataRoute } from 'next';
import { headers } from 'next/headers';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const h = await headers();
  const slug = h.get('x-org-slug') ?? 'default';
  const hostHeader = h.get('host') ?? 'deqah.app';
  const base = `https://${hostHeader}`;
  const routes = ['', '/therapists', '/contact', '/booking', '/support-groups'];
  return routes.flatMap((r) => [
    { url: `${base}/ar${r}`, alternates: { languages: { ar: `${base}/ar${r}`, en: `${base}/en${r}` } } },
    { url: `${base}/en${r}`, alternates: { languages: { ar: `${base}/ar${r}`, en: `${base}/en${r}` } } },
  ]);
}
```

- [ ] **Step 8.2: Add `generateMetadata` in each page for hreflang alternates + structured data**

Example for `app/[locale]/page.tsx`:

```ts
export async function generateMetadata({ params }: { params: { locale: 'ar' | 'en' } }): Promise<Metadata> {
  const h = await headers();
  const host = h.get('host');
  const vertical = h.get('x-vertical') as string;
  const structuredType = { medical: 'MedicalBusiness', consulting: 'ProfessionalService', salon: 'HairSalon', fitness: 'HealthClub' }[vertical];
  return {
    alternates: {
      canonical: `https://${host}/${params.locale}`,
      languages: { ar: `https://${host}/ar`, en: `https://${host}/en` },
    },
    other: {
      'application/ld+json': JSON.stringify({ '@context': 'https://schema.org', '@type': structuredType, name: h.get('x-org-slug') }),
    },
  };
}
```

- [ ] **Step 8.3: SEO snapshot test**

Create `apps/website/__tests__/seo.snapshot.test.ts` with snapshots of sitemap + metadata output for 4 (vertical, locale) combinations.

- [ ] **Step 8.4: Commit**

```bash
git add apps/website/app apps/website/__tests__/seo.snapshot.test.ts
git commit -m "feat(saas-08): bilingual SEO — hreflang + per-tenant sitemap + structured data"
```

---

## Task 9 — Embed widget

- [ ] **Step 9.1: Write widget source**

Create `apps/landing/widget-src/widget.ts`:

```ts
(function () {
  const script = document.currentScript as HTMLScriptElement;
  const slug = script.dataset.org;
  if (!slug) return;

  const iframe = document.createElement('iframe');
  iframe.src = `https://${slug}.deqah.app/ar/widget/book`;
  iframe.style.cssText = 'width:100%;height:720px;border:0;border-radius:16px';
  iframe.title = 'Book appointment';
  script.parentNode?.insertBefore(iframe, script.nextSibling);

  // Fire analytics
  fetch('https://api.deqah.app/api/v1/public/widget/track', {
    method: 'POST',
    body: JSON.stringify({ slug, event: 'mount', referrer: document.referrer }),
    headers: { 'Content-Type': 'application/json' },
  }).catch(() => {});
})();
```

- [ ] **Step 9.2: Build script**

Create `apps/landing/widget-src/build.ts`:

```ts
import { build } from 'esbuild';
await build({
  entryPoints: ['widget-src/widget.ts'],
  outfile: 'public/widget.js',
  bundle: true,
  minify: true,
  target: ['es2018'],
  format: 'iife',
});
```

Add to `apps/landing/package.json` scripts: `"build:widget": "tsx widget-src/build.ts"`. Call from `build` script: `"build": "next build && npm run build:widget"`.

- [ ] **Step 9.3: Widget route in website**

Create `apps/website/app/[locale]/widget/book/page.tsx` — a stripped-down booking flow, no layout chrome, iframe-friendly.

**Framing policy — MUST implement exactly as shown below.** Removing `X-Frame-Options: DENY` without replacing it opens the widget to clickjacking from any site. We replace it with a CSP `frame-ancestors` allowlist scoped to `/widget/*` only. The rest of the site keeps `X-Frame-Options: DENY`.

Add to `apps/website/next.config.mjs`:

```js
// apps/website/next.config.mjs
export default {
  async headers() {
    return [
      {
        // Widget routes: allow framing only from deqah.app + *.deqah.app + the
        // tenant's registered custom domains. No X-Frame-Options (deprecated and
        // conflicts with frame-ancestors; modern browsers prefer CSP).
        source: '/:locale/widget/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "frame-ancestors 'self' https://deqah.app https://*.deqah.app;",
          },
          // Explicitly remove X-Frame-Options for this route (Next.js default may
          // inject it via middleware/hosting). If the hosting layer adds one, strip
          // it in middleware.ts for /widget/* — never fall back to ALLOWALL.
        ],
      },
      {
        // Everything else: keep strict deny.
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Content-Security-Policy', value: "frame-ancestors 'none';" },
        ],
      },
    ];
  },
};
```

**Per-tenant custom domain support:** when a tenant has a verified custom domain (Plan 09), `frame-ancestors` must also include that origin. Implement this in `apps/website/middleware.ts` by reading the resolved tenant for the current Host and appending their custom domain to the CSP header dynamically:

```ts
// apps/website/middleware.ts (excerpt)
if (req.nextUrl.pathname.match(/^\/[a-z]{2}\/widget\//)) {
  const tenant = await resolveTenantFromHost(req.headers.get('host'));
  const extra = tenant?.customDomain ? ` https://${tenant.customDomain}` : '';
  res.headers.set(
    'Content-Security-Policy',
    `frame-ancestors 'self' https://deqah.app https://*.deqah.app${extra};`,
  );
  res.headers.delete('X-Frame-Options');
}
```

**FORBIDDEN alternatives** — do not implement any of these even if they look simpler:
- `frame-ancestors *` / `frame-ancestors 'unsafe-any'` — equivalent to ALLOWALL, reopens clickjacking.
- `X-Frame-Options: ALLOWALL` (not a real value; browsers ignore it, leaving no protection).
- Removing `X-Frame-Options: DENY` site-wide instead of per-route.
- Echoing the `Origin`/`Referer` header into `frame-ancestors` (same class of bug as the Caddy CORS reflection issue in Plan 09).

- [ ] **Step 9.4: Widget tracking endpoint**

Create `apps/backend/src/api/public/widget/widget-track.controller.ts` — `POST /api/v1/public/widget/track` accepts `{ slug, event, referrer }`, logs to an `ActivityLog` row (or a dedicated `WidgetMountEvent` table if preferred). Throttled 10 req/min/IP.

- [ ] **Step 9.5: Integration test**

Create `apps/website/__tests__/widget-integration.test.ts` — spins up Next.js in test mode and asserts:
- `/widget/book` returns HTML without `<header>`/`<footer>`.
- `/widget/book` response has NO `X-Frame-Options` header.
- `/widget/book` response has `Content-Security-Policy` containing `frame-ancestors 'self' https://deqah.app https://*.deqah.app` (plus the tenant's custom domain if one is registered for the test fixture).
- CSP does NOT contain `*`, `'unsafe-any'`, or reflect the request's Origin/Referer header.
- A non-widget route (e.g. `/ar/services`) still returns `X-Frame-Options: DENY` and `frame-ancestors 'none'`.

- [ ] **Step 9.6: Commit**

```bash
git add apps/landing/widget-src apps/landing/package.json apps/website/app/[locale]/widget apps/backend/src/api/public/widget
git commit -m "feat(saas-08): embed booking widget (widget.js + /widget/book route + tracking)"
```

---

## Task 10 — Update API client + backend API contract test

- [ ] **Step 10.1: Add typed client methods**

Edit `packages/api-client/src/endpoints/public.ts`:

```ts
export async function getSiteSettings(slug: string): Promise<SiteSettings> { /* … */ }
export async function trackWidget(input: { slug: string; event: string; referrer?: string }): Promise<void> { /* … */ }
```

Add `SiteSettings` type to `packages/shared/src/types/site-settings.ts`.

- [ ] **Step 10.2: Commit**

```bash
git add packages/api-client packages/shared
git commit -m "feat(saas-08): typed site-settings + widget-track client"
```

---

## Task 11 — Chrome DevTools MCP manual QA (2 orgs × 2 verticals × 2 locales)

Per root CLAUDE.md, website manual QA uses Chrome DevTools MCP.

- [ ] **Step 11.1: Seed two test orgs**

Via Prisma Studio or a dev script, create:
- `clinic-medical-qa`: vertical=medical, visual=ocean, locale=ar, websiteEnabled=true, status=ACTIVE.
- `clinic-salon-qa`: vertical=salon, visual=royal, locale=en, websiteEnabled=true, status=ACTIVE.

Add `*.localhost` to your local hosts file so subdomain routing works locally.

- [ ] **Step 11.2: Boot**

```bash
npm run docker:up
npm run dev:all
```

- [ ] **Step 11.3: QA matrix — 8 combinations**

Open Chrome DevTools MCP and visit each URL, screenshot + sanity-check against the QA checklist below:

1. `http://clinic-medical-qa.localhost:5104/ar` — medical × ocean × AR (RTL)
2. `http://clinic-medical-qa.localhost:5104/en` — medical × ocean × EN (LTR)
3. `http://clinic-salon-qa.localhost:5104/ar` — salon × royal × AR
4. `http://clinic-salon-qa.localhost:5104/en` — salon × royal × EN
5. `http://clinic-medical-qa.localhost:5104/ar/therapists` — nested page AR
6. `http://clinic-salon-qa.localhost:5104/en/booking` — nested page EN
7. `http://clinic-medical-qa.localhost:5104/ar/widget/book` — widget iframe (no chrome)
8. `http://clinic-salon-qa.localhost:5104/ar` with `siteSettings.websiteEnabled=false` temporarily toggled → verify embed-only placeholder.

**Per-URL checklist:**
- HTML `dir` matches locale (rtl for ar, ltr for en).
- Primary color applied from `--color-primary` (visual) with org override via `--color-primary-override`.
- `<title>` localized.
- hreflang alternates present in `<head>`.
- Structured data JSON-LD `@type` matches vertical.
- No console errors.
- Zero Tailwind missing-class warnings.

- [ ] **Step 11.4: Write QA report**

Save to `docs/superpowers/qa/saas-08-website-multi-tenant-<date>.md` with all screenshots + Kiwi links.

- [ ] **Step 11.5: Kiwi sync**

Write plan JSON at `data/kiwi/website-multi-tenant-<date>.json` and run:

```bash
npm run kiwi:sync-manual data/kiwi/website-multi-tenant-<date>.json
```

---

## Task 12 — Docs + memory + PR

- [ ] **Step 12.1: Update root `CLAUDE.md`**

Add note about multi-tenant website + 4 visual × 4 vertical matrix.

- [ ] **Step 12.2: Update `docs/superpowers/plans/2026-04-21-saas-transformation-index.md`**

Flip Plan 08 status. Log progress.

- [ ] **Step 12.3: Create `memory/saas08_status.md`**

Status + key facts + any divergences.

- [ ] **Step 12.4: Open PR**

```bash
gh pr create --title "feat(saas-08): website multi-tenant + 4×4 vertical/visual themes" \
  --body "$(cat <<'EOF'
## Summary
- Host-based tenant resolution via middleware.
- 4 vertical × 4 visual theme composition.
- sawaa → consulting×mint (lossless migration).
- Bilingual SEO (hreflang + sitemap + structured data).
- Embed widget + tracking endpoint.

## Tests
- tenant-resolver (4 cases), theme-resolver (16 combos), middleware (header injection), SEO snapshots, widget integration.
- Manual QA: Chrome DevTools MCP matrix of 2 orgs × 2 verticals × 2 locales, synced to Kiwi.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Critical Lessons (to propagate)

1. **Edge runtime forbids Prisma.** Middleware must use HTTP fetch to backend. Cache aggressively (`unstable_cache`).
2. **`include` in a public handler scope-injects children.** Fix: two-step fetches with explicit `organizationId`.
3. **`X-Frame-Options: DENY` breaks the widget.** Use `X-Frame-Options: ALLOWALL` or remove it on `/widget/*`; rely on Content-Security-Policy `frame-ancestors` instead.
4. **Subdomain cookies in dev require `*.localhost`.** Document in the website CLAUDE.md.
5. **Hex colors in migrated themes = invisible regressions.** Always grep for `#[0-9a-f]` after theme migration.

---

## Amendments applied during execution

> _Empty until execution._
