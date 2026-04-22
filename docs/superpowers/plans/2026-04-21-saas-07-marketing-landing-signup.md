# SaaS-07 — Marketing Landing Site + Signup Wizard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Owner-review required**: this plan touches Moyasar (payments/auth) and creates new public signup endpoints. Per root `CLAUDE.md`, payments + auth are owner-only. Every Moyasar-adjacent change needs explicit owner sign-off before merge.

**Goal:** Build a brand-new Next.js 15 app at `apps/landing/` served on `carekit.app` — the root marketing domain. Contains: a marketing homepage, 8 vertical-specific landing pages (dental, cosmetic, etc.), a pricing page listing the 3 Plans from Plan 04, and a 5-step signup wizard that (1) picks vertical, (2) collects clinic info + slug, (3) selects plan, (4) collects payment via Moyasar, (5) creates the Organization + seeds from Vertical + redirects to `{slug}.carekit.app/dashboard?welcome=true`.

**Architecture:** New Next.js 15 App Router app consuming `@carekit/ui` (from Plan 05a), `@carekit/api-client`, `@carekit/shared`. Uses next-intl for AR/EN. The signup wizard is a client-side state machine that calls public (unauthenticated) API endpoints added in this plan. A single orchestration endpoint `POST /api/v1/public/signup` performs all creation inside a Prisma `$transaction` and returns a JWT that the landing app stores as a same-domain cookie readable from `{slug}.carekit.app` via a shared parent cookie on `.carekit.app`.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript 5.4 strict, Tailwind 4, shadcn/ui via `@carekit/ui`, next-intl 4, `@carekit/api-client`, Moyasar hosted checkout + webhook, Prisma 7, BullMQ (for post-signup welcome email job), Vitest, Playwright-free e2e (Chrome DevTools MCP for manual QA).

---

## 📌 Owner decisions integrated 2026-04-22 (executor: read before Task 0)

The `organizationSlug` JWT claim introduced by this plan needs a sub-spec. Task 0 (new) enforces:

1. **Display-only — authorization NEVER uses `slug`.** All authz continues to use `organizationId`. Any guard/CASL rule that reads `slug` from the JWT = bug.
2. **Refresh-flow re-lookup.** `POST /api/v1/auth/refresh` must re-query `Organization.slug` from the DB (not copy from the old access token). Stale window ≤ one access-token TTL (15 min).
3. **Migration for pre-07 tokens.** Guard treats missing claim as "look up once by `organizationId`", proceeds. Next refresh adds the claim. No forced re-login.
4. **Token-size budget.** Slugs ≤ 48 chars (enforced in `slug-available`). JWT grows ≤ 60 bytes.
5. **Suspended-org guard stays on `organizationId`.** The `JwtAuthGuard.checkSuspended()` lookup (shared with Plan 05b) queries `Organization.suspendedAt` by `organizationId`, never by slug.

Task 0 below blocks execution until owner posts `/approve saas-07` on this sub-spec + the Moyasar charge-then-refund-on-tx-failure flow.

---

## Critical lessons carried forward

1. **`$transaction` callback form bypasses the Proxy** (Lesson 11 from index). The signup orchestration runs inside `$transaction(async tx => {...})` creating Organization + Membership + User + Subscription + seeded rows. `organizationId` must be set explicitly on every `tx.*.create` for SCOPED_MODELS. The brand-new organization has no tenant context yet — use the newly-created `organization.id` directly.
2. **Singleton upsert-on-read pattern** (Lesson 10). After creating the org, seed `BrandingConfig` + `OrganizationSettings` + `SiteSetting` via `tx.*.create` with the new `organization.id`.
3. **Moyasar owner-review:** any change that touches the Moyasar adapter, webhook signature, or payment-handler callsites requires the owner's explicit approval. Call these out in the PR body.
4. **Subdomain cookie strategy:** the signup endpoint returns a JWT cookie on `.carekit.app` (parent domain) so `{slug}.carekit.app/dashboard` can read it without a second login. Document this in the plan body.
5. **Public endpoints are rate-limited.** All `/api/v1/public/signup` + `slug-available` endpoints go through `@nestjs/throttler` with stricter limits than the dashboard bucket (plan 10 tunes these; this plan sets baseline defaults).
6. **Slug regex + reservation list:** reserve `www`, `api`, `admin`, `app`, `dashboard`, `carekit`, `cdn`, `static`, `assets`, `signup`, `login`, `support` from signup.
7. **Charge-before-tx requires compensating refund** (BLOCKER). Moyasar is charged *before* the `$transaction` (step 2), so any tx failure after a successful charge leaves the customer with money taken and no Organization. The handler MUST wrap `$transaction` in try/catch and call `moyasar.refund(charge.id, { reason: 'signup_tx_failed' })` on failure. If the refund call itself throws, enqueue a BullMQ retry (`signup-refund-retry`, `jobId: refund-<chargeId>` for idempotency) and re-raise the original tx error. Pre-requisites for this plan: (a) `MoyasarAdapter.refund(paymentId, opts)` method must exist (extend the adapter in Step 3.1 if missing — owner-review required, payments module), (b) `BullModule.registerQueue({ name: 'signup-refund-retry' })` must be added to the signup module imports, (c) a consumer/processor for that queue that re-attempts `moyasar.refund` with exponential backoff and alerts ops after max attempts.

---

## File Structure

### New app — `apps/landing/`

| Path | Responsibility |
|---|---|
| `apps/landing/package.json` | Workspace manifest, next-intl + @carekit/* deps |
| `apps/landing/next.config.mjs` | Port 5105, i18n routing, transpile `@carekit/*` |
| `apps/landing/tsconfig.json` | Extends root; strict |
| `apps/landing/tailwind.config.ts` + `app/globals.css` | Tailwind 4 with CareKit brand tokens + `@source` for `packages/ui` |
| `apps/landing/middleware.ts` | next-intl locale routing (`/`, `/ar`, `/en`) |
| `apps/landing/app/layout.tsx` | Root layout with `<NextIntlClientProvider>` |
| `apps/landing/app/[locale]/layout.tsx` | Per-locale layout, direction switch |
| `apps/landing/app/[locale]/page.tsx` | Marketing homepage |
| `apps/landing/app/[locale]/verticals/[slug]/page.tsx` | Vertical-specific landing (data from `GET /public/verticals`) |
| `apps/landing/app/[locale]/pricing/page.tsx` | Plans + comparison + FAQ |
| `apps/landing/app/[locale]/signup/page.tsx` | 5-step wizard shell |
| `apps/landing/app/[locale]/signup/components/wizard-stepper.tsx` | Stepper UI |
| `apps/landing/app/[locale]/signup/components/step-vertical.tsx` | Step 1 |
| `apps/landing/app/[locale]/signup/components/step-clinic.tsx` | Step 2 |
| `apps/landing/app/[locale]/signup/components/step-plan.tsx` | Step 3 |
| `apps/landing/app/[locale]/signup/components/step-payment.tsx` | Step 4 (Moyasar hosted checkout iframe) |
| `apps/landing/app/[locale]/signup/components/step-success.tsx` | Step 5 (post-create redirect) |
| `apps/landing/app/[locale]/signup/state/wizard-machine.ts` | Pure state machine (no side effects) |
| `apps/landing/app/[locale]/login/page.tsx` | Login form — posts to `POST /api/v1/auth/login`, routes based on `isSuperAdmin` claim (→ `admin.carekit.app`) or `membership.organizationSlug` (→ `{slug}.carekit.app/dashboard`) |
| `apps/landing/app/[locale]/legal/terms/page.tsx` | Terms of service (required by Moyasar) |
| `apps/landing/app/[locale]/legal/privacy/page.tsx` | Privacy policy |
| `apps/landing/app/[locale]/legal/refund/page.tsx` | Refund policy |
| `apps/landing/app/api/signup/route.ts` | Proxies to backend `POST /api/v1/public/signup`, sets `.carekit.app` cookie on success |
| `apps/landing/messages/ar.json`, `en.json` | Full translations |
| `apps/landing/public/*` | Static assets: logo, hero gradients, vertical icons |
| `apps/landing/CLAUDE.md` | App conventions (port, i18n, wizard state) |

### Backend additions — `apps/backend/`

| Path | Responsibility |
|---|---|
| `src/api/public/signup/signup.controller.ts` | `POST /api/v1/public/signup` + `GET /api/v1/public/organizations/slug-available` |
| `src/modules/platform/signup/create-organization.handler.ts` | Orchestrates Organization + User + Membership + Subscription + seeding in one `$transaction` |
| `src/modules/platform/signup/seed-from-vertical.service.ts` | Copies `VerticalSeedDepartment` + default branch + default categories into the new org |
| `src/modules/platform/signup/reserved-slugs.ts` | List of reserved slugs |
| `src/modules/platform/signup/__tests__/create-organization.handler.spec.ts` | Unit test (happy path + conflict + payment decline) |
| `src/modules/platform/signup/__tests__/slug-validator.spec.ts` | Unit test (regex + reserved list) |
| `test/e2e/signup/public-signup.e2e-spec.ts` | Full happy-path + slug-taken + payment-declined e2e |

### Modified files

- Root `package.json` — add `apps/landing` to `workspaces`
- Root `turbo.json` — add landing to pipeline
- Root `CLAUDE.md` — add `apps/landing/` to Structure tree + `carekit.app` domain
- `docker/nginx/nginx.conf` — route `carekit.app → apps/landing :5105`
- `docker/docker-compose.yml` — add `landing` service
- `packages/api-client/src/endpoints/public.ts` — typed `signup`, `slugAvailable`, `getVerticals`, `getPlans` helpers
- `memory/saas07_status.md` — new memory file after execution

---

## Task 1 — Scaffold `apps/landing/` workspace

- [ ] **Step 1.1: Verify port 5105 is free and uncontested**

```bash
lsof -i :5105 || echo "5105 free"
grep -rn "5105" /Users/tariq/code/carekit --include="*.json" --include="*.ts" --include="*.mjs" --include="*.conf" --include="*.yml" 2>/dev/null | head
```

Expected: no existing binding. If occupied, propose an alternative port in the 5100-5199 range and document the divergence.

- [ ] **Step 1.2: Create `apps/landing/package.json`**

```json
{
  "name": "@carekit/landing",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev -p 5105",
    "build": "next build",
    "start": "next start -p 5105",
    "lint": "next lint",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "next": "^15.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "next-intl": "^4.0.0",
    "@carekit/ui": "*",
    "@carekit/shared": "*",
    "@carekit/api-client": "*",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "@types/node": "^22.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "tailwindcss": "^4.0.0",
    "postcss": "^8.5.0",
    "vitest": "^4.1.4",
    "@testing-library/react": "^16.1.0",
    "jsdom": "^25.0.0"
  }
}
```

- [ ] **Step 1.3: Create `apps/landing/next.config.mjs`**

```js
import createNextIntlPlugin from 'next-intl/plugin';
const withNextIntl = createNextIntlPlugin('./i18n.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@carekit/ui', '@carekit/shared', '@carekit/api-client'],
  experimental: { typedRoutes: true },
};

export default withNextIntl(nextConfig);
```

- [ ] **Step 1.4: Create `apps/landing/tsconfig.json`**, `tailwind.config.ts`, `app/globals.css`, `middleware.ts`, `i18n.ts`

Mirror the shape of `apps/dashboard/`. Key lines:

- `tailwind.config.ts` content array MUST include `../../packages/ui/src/**/*.{ts,tsx}`.
- `middleware.ts` uses `createMiddleware` from `next-intl/middleware` with `locales: ['ar', 'en']`, `defaultLocale: 'ar'`.

- [ ] **Step 1.5: Register workspace**

Edit root `package.json` `workspaces` array to include `apps/landing`.

- [ ] **Step 1.6: Install**

```bash
npm install
```

- [ ] **Step 1.7: Smoke dev server**

```bash
npm run dev --workspace=@carekit/landing
```

Open `http://localhost:5105` — should render an empty Next.js welcome until pages are written.

- [ ] **Step 1.8: Commit**

```bash
git add apps/landing package.json package-lock.json
git commit -m "feat(saas-07): scaffold apps/landing workspace on port 5105"
```

---

## Task 2 — Backend: slug-available endpoint + reserved slug list

- [ ] **Step 2.1: Create reserved slug list**

Create `apps/backend/src/modules/platform/signup/reserved-slugs.ts`:

```ts
export const RESERVED_SLUGS = new Set<string>([
  'www', 'api', 'admin', 'app', 'dashboard', 'carekit', 'cdn',
  'static', 'assets', 'signup', 'login', 'support', 'help',
  'docs', 'blog', 'status', 'billing', 'accounts',
]);

export const SLUG_REGEX = /^[a-z][a-z0-9-]{2,30}[a-z0-9]$/; // 4-32 chars, lowercase letters/digits/hyphens, no leading/trailing hyphen
```

- [ ] **Step 2.2: Write unit test for slug validation**

Create `apps/backend/src/modules/platform/signup/__tests__/slug-validator.spec.ts`:

```ts
import { RESERVED_SLUGS, SLUG_REGEX } from '../reserved-slugs';

describe('slug validator', () => {
  it('accepts valid slugs', () => {
    ['clinic-one', 'downtown-dental', 'abc123'].forEach((s) =>
      expect(SLUG_REGEX.test(s)).toBe(true),
    );
  });
  it('rejects too short, leading hyphen, uppercase', () => {
    ['abc', '-abc', 'Abc', 'abc-', 'abc--'].forEach((s) =>
      expect(SLUG_REGEX.test(s)).toBe(false),
    );
  });
  it('reserves common names', () => {
    expect(RESERVED_SLUGS.has('admin')).toBe(true);
    expect(RESERVED_SLUGS.has('api')).toBe(true);
    expect(RESERVED_SLUGS.has('dashboard')).toBe(true);
  });
});
```

Run: `cd apps/backend && npx jest modules/platform/signup/__tests__/slug-validator`

Expected: 3 green.

- [ ] **Step 2.3: Create controller + handler**

Create `apps/backend/src/api/public/signup/signup.controller.ts` with `GET /api/v1/public/organizations/slug-available?slug=X`. Returns `{ available: boolean, reason?: 'reserved' | 'taken' | 'invalid' }`. Rate-limited via `@UseGuards(PublicThrottlerGuard)` — 20 req/min/IP.

Handler logic:

1. Lowercase + trim.
2. If `!SLUG_REGEX.test(slug)` → `{ available: false, reason: 'invalid' }`.
3. If `RESERVED_SLUGS.has(slug)` → `{ available: false, reason: 'reserved' }`.
4. `organization.findFirst({ where: { slug } })` → if found, `{ available: false, reason: 'taken' }`.
5. Else `{ available: true }`.

Note: the `organization.findFirst` here runs in a PUBLIC (unauthenticated) context. The Prisma extension must not inject `organizationId` on this call. `Organization` is a platform model and is NOT in `SCOPED_MODELS` — verify this in `prisma.service.ts` before writing the handler.

- [ ] **Step 2.4: Register controller**

Add to `apps/backend/src/api/public/public.module.ts`: import `SignupController`.

- [ ] **Step 2.5: Commit**

```bash
git add apps/backend/src/modules/platform/signup apps/backend/src/api/public/signup apps/backend/src/api/public/public.module.ts
git commit -m "feat(saas-07): slug-available endpoint + reserved-slug list"
```

---

## Task 3 — Backend: `POST /api/v1/public/signup` orchestration handler

- [ ] **Step 3.1: Write unit test FIRST (TDD)**

Create `apps/backend/src/modules/platform/signup/__tests__/create-organization.handler.spec.ts`.

Test cases:
- Happy path: valid payload → creates Organization + User (owner role) + Membership + BrandingConfig + OrganizationSettings + SiteSetting + copies `VerticalSeedDepartment` rows + creates trial `Subscription` (status=TRIALING) + returns `{ organizationId, slug, accessToken, refreshToken }`.
- Slug conflict: passes `RESERVED_SLUGS.has(slug)` but another org created it concurrently → throws `ConflictException` (rely on `@unique` index).
- Email conflict: another user with that email exists in the platform (cross-org) → throws `ConflictException`. (Per `02b` lesson: email unique is now composite `@@unique([organizationId, email])` on Employee; User/Owner email uniqueness is platform-level — confirm in `identity.prisma` before writing this test.)
- Payment decline path: passed-in `moyasarPaymentToken` returns FAILED from Moyasar adapter → whole transaction rolls back, no Organization created.

Run: expects failures until Step 3.3 completes.

- [ ] **Step 3.2: Create the handler skeleton**

Create `apps/backend/src/modules/platform/signup/create-organization.handler.ts`:

```ts
import { Injectable, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { MoyasarAdapter } from '../../finance/moyasar/moyasar.adapter';
import { JwtService } from '../../auth/jwt.service';
import { SeedFromVerticalService } from './seed-from-vertical.service';
import { RESERVED_SLUGS, SLUG_REGEX } from './reserved-slugs';
import { hashPassword } from '../../auth/password';

export interface CreateOrganizationCommand {
  verticalSlug: string;
  organization: { slug: string; nameAr: string; nameEn: string; phone: string; country: string };
  owner: { email: string; password: string; firstNameAr: string; firstNameEn: string };
  planId: string;
  moyasarPaymentToken: string;
  locale: 'ar' | 'en';
}

@Injectable()
export class CreateOrganizationHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly moyasar: MoyasarAdapter,
    private readonly jwt: JwtService,
    private readonly seed: SeedFromVerticalService,
    @InjectQueue('signup-refund-retry') private readonly signupRefundRetryQueue: Queue,
    private readonly logger: Logger,
  ) {}

  async execute(cmd: CreateOrganizationCommand) {
    // 1. Pre-validate slug (regex + reserved)
    if (!SLUG_REGEX.test(cmd.organization.slug)) throw new BadRequestException('invalid_slug');
    if (RESERVED_SLUGS.has(cmd.organization.slug)) throw new ConflictException('slug_reserved');

    // 2. Charge the payment FIRST (outside tx) — if it fails, no DB mutation.
    //    Moyasar returns a payment id + status. We create the Payment row inside the tx.
    const charge = await this.moyasar.chargeSignup({
      token: cmd.moyasarPaymentToken,
      planId: cmd.planId,
    });
    if (charge.status !== 'PAID') {
      throw new BadRequestException({ code: 'payment_declined', reason: charge.failureReason });
    }

    // 3. Load plan + vertical (platform models)
    const plan = await this.prisma.plan.findUnique({ where: { id: cmd.planId } });
    if (!plan) throw new BadRequestException('invalid_plan');
    const vertical = await this.prisma.vertical.findUnique({ where: { slug: cmd.verticalSlug } });
    if (!vertical) throw new BadRequestException('invalid_vertical');

    // 4. Transactional creation. tx bypasses the Proxy — set organizationId explicitly on every scoped create.
    //    CRITICAL: Moyasar was already charged in step 2. If $transaction throws (DB failure,
    //    slug race, seed failure, etc.), we MUST refund the charge or the customer loses money
    //    with no Organization to show for it. Wrap the tx in try/catch and issue a compensating
    //    refund via `this.moyasar.refund(charge.id, { reason: 'signup_failed' })` before rethrowing.
    //    The refund call itself must be best-effort: if it also fails, log+alert + enqueue a
    //    BullMQ retry job (`signup-refund-retry`) keyed by `charge.id` (idempotent) so ops can
    //    reconcile manually. Never swallow the original tx error — rethrow after refund attempt.
    let result;
    try {
      result = await this.prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: {
          slug: cmd.organization.slug,
          nameAr: cmd.organization.nameAr,
          nameEn: cmd.organization.nameEn,
          phone: cmd.organization.phone,
          country: cmd.organization.country,
          verticalId: vertical.id,
          status: 'ACTIVE',
        },
      });

      const user = await tx.user.create({
        data: {
          organizationId: org.id,       // User IS scoped (02a)
          email: cmd.owner.email,
          passwordHash: await hashPassword(cmd.owner.password),
          firstNameAr: cmd.owner.firstNameAr,
          firstNameEn: cmd.owner.firstNameEn,
          locale: cmd.locale,
          isSuperAdmin: false,
        },
      });

      await tx.membership.create({
        data: {
          organizationId: org.id,
          userId: user.id,
          role: 'OWNER',
          isDefault: true,
        },
      });

      // Seed org-config singletons (02c pattern)
      await tx.brandingConfig.create({
        data: { organizationId: org.id, primaryColor: vertical.defaultPrimaryColor ?? '#354FD8' },
      });
      await tx.organizationSettings.create({
        data: { organizationId: org.id, defaultLocale: cmd.locale, timezone: 'Asia/Riyadh' },
      });
      await tx.siteSetting.create({
        data: { organizationId: org.id, websiteEnabled: plan.tier !== 'STARTER', theme: vertical.defaultTheme },
      });

      // Seed from vertical template (departments, service categories, default branch)
      await this.seed.seedTransactional(tx, org.id, vertical.id);

      // Subscription + first payment
      const subscription = await tx.subscription.create({
        data: {
          organizationId: org.id,
          planId: plan.id,
          status: 'TRIALING',
          trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });
      await tx.payment.create({
        data: {
          organizationId: org.id,           // TODO(02e): confirm Payment scoped before this plan ships
          subscriptionId: subscription.id,
          moyasarPaymentId: charge.id,
          amount: plan.monthlyPrice,
          currency: 'SAR',
          status: 'PAID',
        },
      });

        return { org, user };
      });
    } catch (txError) {
      // Compensating refund — customer must not be charged without an account.
      try {
        await this.moyasar.refund(charge.id, { reason: 'signup_tx_failed' });
      } catch (refundError) {
        // Refund itself failed — enqueue retry + alert. Do NOT swallow the original error.
        await this.signupRefundRetryQueue.add(
          'signup-refund-retry',
          { moyasarPaymentId: charge.id, reason: 'signup_tx_failed' },
          { jobId: `refund-${charge.id}`, attempts: 10, backoff: { type: 'exponential', delay: 60000 } },
        );
        this.logger.error({ chargeId: charge.id, refundError, txError }, 'signup refund failed — retry enqueued');
      }
      throw txError;
    }

    // 5. Issue JWT (same as normal login path)
    const tokens = await this.jwt.issueTokenPair({
      userId: result.user.id,
      organizationId: result.org.id,
      role: 'OWNER',
    });

    return {
      organizationId: result.org.id,
      slug: result.org.slug,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }
}
```

- [ ] **Step 3.3: Implement `SeedFromVerticalService`**

Create `apps/backend/src/modules/platform/signup/seed-from-vertical.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

@Injectable()
export class SeedFromVerticalService {
  async seedTransactional(tx: Prisma.TransactionClient, organizationId: string, verticalId: string) {
    // Default branch
    const branch = await tx.branch.create({
      data: {
        organizationId,
        nameAr: 'الفرع الرئيسي',
        nameEn: 'Main Branch',
        isDefault: true,
      },
    });

    // Copy seed departments (Plan 03 introduced VerticalSeedDepartment)
    const seedDepts = await tx.verticalSeedDepartment.findMany({ where: { verticalId } });
    for (const d of seedDepts) {
      await tx.department.create({
        data: {
          organizationId,
          branchId: branch.id,
          nameAr: d.nameAr,
          nameEn: d.nameEn,
        },
      });
    }

    // Seed default service categories (one "General" category)
    await tx.serviceCategory.create({
      data: {
        organizationId,
        nameAr: 'عام',
        nameEn: 'General',
      },
    });
  }
}
```

- [ ] **Step 3.4: Wire controller**

Extend `signup.controller.ts`:

```ts
@Controller('public/signup')
@UseGuards(PublicThrottlerGuard) // 5 req/min/IP for signup
export class SignupController {
  constructor(private readonly handler: CreateOrganizationHandler) {}

  @Post()
  async signup(@Body() dto: SignupDto) {
    return this.handler.execute(dto);
  }
}
```

Create a Zod DTO via `class-validator` matching `CreateOrganizationCommand`.

- [ ] **Step 3.5: Run unit tests**

```bash
cd apps/backend && npx jest modules/platform/signup --no-coverage
```

Expected: all green. Fix any divergences.

- [ ] **Step 3.6: Commit**

```bash
git add apps/backend/src/modules/platform/signup apps/backend/src/api/public/signup
git commit -m "feat(saas-07): POST /api/v1/public/signup orchestration handler"
```

---

## Task 4 — Backend: e2e happy-path + failure-path tests

- [ ] **Step 4.1: Create e2e spec**

Create `apps/backend/test/e2e/signup/public-signup.e2e-spec.ts`:

```ts
describe('Public signup (07)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let moyasar: jest.Mocked<MoyasarAdapter>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(MoyasarAdapter)
      .useValue({ chargeSignup: jest.fn() })
      .compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    moyasar = app.get(MoyasarAdapter);
  });

  it('happy path — creates Organization + User + Subscription + seeded rows', async () => {
    moyasar.chargeSignup.mockResolvedValue({ id: 'pay_123', status: 'PAID' });
    const res = await request(app.getHttpServer())
      .post('/api/v1/public/signup')
      .send({
        verticalSlug: 'dental',
        organization: { slug: 'test-clinic-07', nameAr: 'عيادة', nameEn: 'Clinic', phone: '+966501234567', country: 'SA' },
        owner: { email: 'owner@test07.com', password: 'Test1234!', firstNameAr: 'مالك', firstNameEn: 'Owner' },
        planId: 'plan-pro',
        moyasarPaymentToken: 'tok_abc',
        locale: 'ar',
      })
      .expect(201);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.slug).toBe('test-clinic-07');
    const org = await prisma.organization.findUnique({ where: { slug: 'test-clinic-07' } });
    expect(org).toBeTruthy();
    const branch = await prisma.branch.findFirst({ where: { organizationId: org!.id } });
    expect(branch?.isDefault).toBe(true);
  });

  it('slug-taken path returns 409', async () => {
    moyasar.chargeSignup.mockResolvedValue({ id: 'pay_124', status: 'PAID' });
    // same slug as happy path
    await request(app.getHttpServer())
      .post('/api/v1/public/signup')
      .send({ /* ...same body with slug test-clinic-07... */ })
      .expect(409);
  });

  it('payment-declined path returns 400 and does not create organization', async () => {
    moyasar.chargeSignup.mockResolvedValue({ id: 'pay_125', status: 'FAILED', failureReason: 'insufficient_funds' });
    await request(app.getHttpServer())
      .post('/api/v1/public/signup')
      .send({ /* body with slug declined-07 */ })
      .expect(400);
    const org = await prisma.organization.findUnique({ where: { slug: 'declined-07' } });
    expect(org).toBeNull();
  });

  it('tx-failure after charge triggers compensating refund', async () => {
    // Charge succeeds, but seed fails mid-tx — refund must be called with the charge id.
    moyasar.chargeSignup.mockResolvedValue({ id: 'pay_126', status: 'PAID' });
    moyasar.refund.mockResolvedValue({ id: 'ref_126', status: 'REFUNDED' });
    jest.spyOn(SeedFromVerticalService.prototype, 'seedTransactional').mockRejectedValueOnce(new Error('seed boom'));
    await request(app.getHttpServer())
      .post('/api/v1/public/signup')
      .send({ /* body with slug tx-fail-07 */ })
      .expect(500);
    expect(moyasar.refund).toHaveBeenCalledWith('pay_126', expect.objectContaining({ reason: 'signup_tx_failed' }));
    const org = await prisma.organization.findUnique({ where: { slug: 'tx-fail-07' } });
    expect(org).toBeNull();
  });

  it('refund failure enqueues retry job and still surfaces original error', async () => {
    moyasar.chargeSignup.mockResolvedValue({ id: 'pay_127', status: 'PAID' });
    moyasar.refund.mockRejectedValue(new Error('moyasar refund 500'));
    jest.spyOn(SeedFromVerticalService.prototype, 'seedTransactional').mockRejectedValueOnce(new Error('seed boom'));
    await request(app.getHttpServer())
      .post('/api/v1/public/signup')
      .send({ /* body with slug tx-fail-retry-07 */ })
      .expect(500);
    expect(signupRefundRetryQueue.add).toHaveBeenCalledWith(
      'signup-refund-retry',
      expect.objectContaining({ moyasarPaymentId: 'pay_127' }),
      expect.objectContaining({ jobId: 'refund-pay_127' }),
    );
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({ where: { slug: { startsWith: 'test-clinic-07' } } });
    await app.close();
  });
});
```

- [ ] **Step 4.2: Run**

```bash
cd apps/backend && npm run test:e2e -- signup/public-signup
```

- [ ] **Step 4.3: Commit**

```bash
git add apps/backend/test/e2e/signup
git commit -m "test(saas-07): signup e2e — happy path + slug-taken + payment-declined"
```

---

## Task 5 — Landing: wizard state machine (pure, unit-tested first)

- [ ] **Step 5.1: Write state machine test first**

Create `apps/landing/app/[locale]/signup/state/wizard-machine.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { initialState, reducer, canAdvance } from './wizard-machine';

describe('wizard-machine', () => {
  it('starts on vertical step', () => {
    expect(initialState.step).toBe('vertical');
  });
  it('cannot advance from vertical without verticalSlug', () => {
    expect(canAdvance(initialState)).toBe(false);
  });
  it('advances vertical -> clinic', () => {
    const s1 = reducer(initialState, { type: 'SET_VERTICAL', slug: 'dental' });
    const s2 = reducer(s1, { type: 'NEXT' });
    expect(s2.step).toBe('clinic');
  });
  it('clinic step requires slug + nameAr + email + password', () => {
    const s1 = reducer(initialState, { type: 'SET_VERTICAL', slug: 'dental' });
    const s2 = reducer(s1, { type: 'NEXT' });
    expect(canAdvance(s2)).toBe(false);
    const s3 = reducer(s2, { type: 'SET_CLINIC', patch: { slug: 'abc-clinic', nameAr: 'ع', email: 'a@b.com', password: 'Pass123!' } });
    expect(canAdvance(s3)).toBe(true);
  });
  it('BACK from payment returns to plan', () => {
    let s = initialState;
    s = reducer(s, { type: 'SET_VERTICAL', slug: 'dental' });
    s = reducer(s, { type: 'NEXT' });
    s = reducer(s, { type: 'SET_CLINIC', patch: { slug: 'abc-clinic', nameAr: 'ع', email: 'a@b.com', password: 'Pass123!' } });
    s = reducer(s, { type: 'NEXT' });
    s = reducer(s, { type: 'SET_PLAN', planId: 'plan-pro' });
    s = reducer(s, { type: 'NEXT' });
    expect(s.step).toBe('payment');
    s = reducer(s, { type: 'BACK' });
    expect(s.step).toBe('plan');
  });
});
```

- [ ] **Step 5.2: Implement the state machine**

Create `apps/landing/app/[locale]/signup/state/wizard-machine.ts`. Pure reducer + canAdvance. No API calls. States: `'vertical' | 'clinic' | 'plan' | 'payment' | 'success'`.

- [ ] **Step 5.3: Run**

```bash
npm run test --workspace=@carekit/landing
```

Expected: 5 green.

- [ ] **Step 5.4: Commit**

```bash
git add apps/landing/app
git commit -m "feat(saas-07): signup wizard state machine"
```

---

## Task 6 — Landing: wizard UI (5 step components + shell)

- [ ] **Step 6.1: Build `wizard-stepper.tsx` + `step-vertical.tsx`**

Fetch verticals via `@carekit/api-client` → `GET /api/v1/public/verticals`. Render grid of cards with vertical icon + name in current locale. Dispatch `SET_VERTICAL` + `NEXT` on click.

- [ ] **Step 6.2: Build `step-clinic.tsx`**

Form fields: `nameAr`, `nameEn`, `slug` (with live availability check debounced 400ms → `GET /api/v1/public/organizations/slug-available`), `phone`, `country` (SA default), owner `email`, owner `password` (min 8 chars, mixed case + digit), `firstNameAr`, `firstNameEn`. Validation via Zod. On valid submit → `SET_CLINIC` + `NEXT`.

- [ ] **Step 6.3: Build `step-plan.tsx`**

Fetch plans via `GET /api/v1/public/plans`. Render 3 plan cards (STARTER/PRO/PREMIUM). Selecting one → `SET_PLAN` + `NEXT`.

- [ ] **Step 6.4: Build `step-payment.tsx` — Moyasar hosted checkout**

Embed Moyasar hosted checkout via their `mysr-form` script. On successful tokenization, the token callback fires → dispatch `SET_PAYMENT_TOKEN` → call `POST /api/landing/signup` (Next route handler that proxies to backend `POST /api/v1/public/signup` and sets a `.carekit.app` cookie with the returned JWT).

Reference: see the `moyasar` skill for hosted-checkout integration specifics. Include CSP allowlist for `https://api.moyasar.com` in `next.config.mjs` headers.

- [ ] **Step 6.5: Build `step-success.tsx`**

Renders spinner + "Preparing your dashboard…" message, then `window.location.href = \`https://${slug}.carekit.app/dashboard?welcome=true\`` after the cookie is set.

For local dev: redirect to `http://${slug}.localhost:5103/dashboard?welcome=true` gated by `NODE_ENV`.

- [ ] **Step 6.6: Build `apps/landing/app/api/signup/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const apiUrl = process.env.BACKEND_URL ?? 'http://localhost:5100';
  const res = await fetch(`${apiUrl}/api/v1/public/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) return NextResponse.json(data, { status: res.status });

  const response = NextResponse.json({ slug: data.slug });
  const cookieDomain = process.env.NODE_ENV === 'production' ? '.carekit.app' : 'localhost';
  response.cookies.set('ck_access', data.accessToken, {
    domain: cookieDomain,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 15,
    path: '/',
  });
  response.cookies.set('ck_refresh', data.refreshToken, {
    domain: cookieDomain,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
  });
  return response;
}
```

- [ ] **Step 6.7: Smoke test**

```bash
npm run dev --workspace=@carekit/landing
```

Walk through the wizard manually with a Moyasar sandbox token.

- [ ] **Step 6.8: Commit**

```bash
git add apps/landing/app
git commit -m "feat(saas-07): 5-step signup wizard UI + Moyasar hosted checkout"
```

---

## Task 7 — Landing: marketing pages (home, verticals, pricing)

- [ ] **Step 7.1: Homepage — `app/[locale]/page.tsx`**

Hero with headline + subheadline + CTA ("ابدأ مجانًا / Start free"), value-prop grid (3 cards), vertical showcase carousel (8 tiles), testimonial strip, footer CTA.

- [ ] **Step 7.2: Vertical landing — `app/[locale]/verticals/[slug]/page.tsx`**

Server-fetch vertical by slug from `GET /api/v1/public/verticals/:slug`. Render: hero tailored to vertical, benefits list (4-6 bullets from vertical config), feature grid, testimonial from vertical pool, vertical-specific CTA.

Static generation: `generateStaticParams()` returns all 8 vertical slugs. `revalidate: 3600`.

- [ ] **Step 7.3: Pricing — `app/[locale]/pricing/page.tsx`**

3 plan cards (STARTER/PRO/PREMIUM) with monthly price + included features + limits. Comparison table below. FAQ accordion.

- [ ] **Step 7.4: Legal pages**

`/legal/terms`, `/legal/privacy`, `/legal/refund` — static markdown content. Required by Moyasar.

- [ ] **Step 7.5: Translations**

Fill `messages/ar.json` + `messages/en.json` with every string used on the pages.

- [ ] **Step 7.6: Commit**

```bash
git add apps/landing
git commit -m "feat(saas-07): marketing homepage + 8 vertical pages + pricing + legal"
```

---

## Task 8 — Landing: login page with role-based routing

- [ ] **Step 8.1: Build `/login`**

Form → `POST /api/v1/auth/login` (existing endpoint). On success, the JWT claims contain `isSuperAdmin` and `organizationSlug` (add `organizationSlug` to JWT payload if not already present — **owner-review item**: confirm with owner before extending JWT).

Routing logic:
- `isSuperAdmin === true` → `https://admin.carekit.app`
- `organizationSlug` present → `https://{slug}.carekit.app/dashboard`
- else → error: "No active clinic membership."

- [ ] **Step 8.2: Commit**

```bash
git add apps/landing/app
git commit -m "feat(saas-07): landing login with role-based redirect"
```

---

## Task 9 — Nginx + docker-compose for landing

- [ ] **Step 9.1: Update `docker/nginx/nginx.conf`**

Add a server block:

```nginx
server {
    listen 443 ssl http2;
    server_name carekit.app www.carekit.app;
    include /etc/nginx/security_headers.conf;
    ssl_certificate /etc/nginx/ssl/carekit.app.pem;
    ssl_certificate_key /etc/nginx/ssl/carekit.app.key;

    location / {
        proxy_pass http://landing:5105;
        include /etc/nginx/proxy_params_common.conf;
    }
}
```

Note: Plan 09 replaces Nginx with Caddy. Keep this stanza simple; Plan 09 will migrate it.

- [ ] **Step 9.2: Update `docker/docker-compose.yml`**

Add landing service:

```yaml
landing:
  build:
    context: ../
    dockerfile: apps/landing/Dockerfile
  ports:
    - "5105:5105"
  environment:
    BACKEND_URL: http://backend:5100
    NODE_ENV: production
  depends_on:
    - backend
```

- [ ] **Step 9.3: Create `apps/landing/Dockerfile`**

Mirror `apps/dashboard/Dockerfile`. Build target `next build`, runtime `next start -p 5105`.

- [ ] **Step 9.4: Commit**

```bash
git add docker apps/landing/Dockerfile
git commit -m "chore(saas-07): Nginx + docker-compose for apps/landing"
```

---

## Task 10 — Chrome DevTools MCP manual QA

Per root CLAUDE.md, dashboard QA uses Chrome DevTools MCP (Playwright removed 2026-04-16). Same applies here.

- [ ] **Step 10.1: Boot full stack**

```bash
npm run docker:up
npm run dev:all  # or bring landing up alongside backend/dashboard
```

- [ ] **Step 10.2: QA the 5 signup steps**

Open `http://localhost:5105` in Chrome DevTools MCP. Walk through:
1. Pick vertical (dental).
2. Fill clinic info (use a unique slug like `qa-test-<timestamp>`).
3. Pick Pro plan.
4. Pay with Moyasar sandbox token `tok_visa_sandbox`.
5. Verify redirect to `{slug}.localhost:5103/dashboard?welcome=true`.

Capture screenshots per step into `docs/superpowers/qa/saas-07-signup-report-<date>.md`.

- [ ] **Step 10.3: QA failure paths**

- Slug-taken: try re-using the slug from the happy path.
- Payment decline: use sandbox card `tok_visa_declined`.
- Invalid slug (`a--b`, `admin`, `ADMIN`).

Each should surface a clear, localized error inside the wizard without navigating away.

- [ ] **Step 10.4: Kiwi TCMS sync**

Write plan JSON at `data/kiwi/signup-<date>.json` per root CLAUDE.md. Then:

```bash
npm run kiwi:sync-manual data/kiwi/signup-<date>.json
```

- [ ] **Step 10.5: Link Kiwi run URLs in the QA report**

---

## Task 11 — Docs + memory + PR

- [ ] **Step 11.1: Update root `CLAUDE.md`**

Add `apps/landing/` to the Structure tree. Add `carekit.app` to domain listing.

- [ ] **Step 11.2: Create `apps/landing/CLAUDE.md`**

Documents: port 5105, AR/EN routing, wizard state machine contract, `BACKEND_URL` env var, cookie domain `.carekit.app`, Moyasar owner-only caveat.

- [ ] **Step 11.3: Update `docs/superpowers/plans/2026-04-21-saas-transformation-index.md`**

Flip Plan 07 status to ✅ DONE in the phase map. Append a Progress log row.

- [ ] **Step 11.4: Create `memory/saas07_status.md`**

```markdown
---
name: SaaS-07 status
description: Plan 07 (marketing site + signup wizard) — status and key facts
type: project
---
**Status:** [fill in: PR #, tests passing, divergences]
**Scope delivered:** apps/landing on :5105, carekit.app, 8 vertical pages + pricing + 5-step signup wizard + Moyasar integration + `.carekit.app` cookie handoff.
**Owner-review items:** JWT payload extension (organizationSlug claim), Moyasar signup charge endpoint.
**Next:** Plan 08 (website multi-tenant + vertical themes).
```

- [ ] **Step 11.5: Open PR**

```bash
gh pr create --title "feat(saas-07): marketing landing + signup wizard on carekit.app" \
  --body "$(cat <<'EOF'
## Summary
New apps/landing workspace on port 5105 serving carekit.app. Marketing homepage + 8 vertical pages + pricing + 5-step signup wizard with Moyasar hosted checkout.

## Owner-review items
- JWT payload extension: added `organizationSlug` claim (touches auth — owner-only).
- Moyasar signup charge handler (touches payments — owner-only).

## Tests
- Unit: signup state machine (5 cases), slug validator (3 cases), create-organization handler (4 cases).
- E2E: signup-happy + slug-taken + payment-declined.
- Manual QA: Chrome DevTools MCP walkthrough of all 5 steps, synced to Kiwi TCMS.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 11.6: Done.**

---

## Critical Lessons (to propagate if they occur)

1. **Cross-subdomain cookies:** `.carekit.app` parent cookie works for `{slug}.carekit.app` children, but requires HTTPS in production. Local dev needs `localhost` cookie (no leading dot for Chrome compliance).
2. **Moyasar token lifetime:** tokens are short-lived (~15 min). If the user stalls on step 4, re-tokenize on submit or the charge will fail with `expired_token`.
3. **Seed ordering inside `$transaction`:** Branch must exist before Department (FK). `vertical.findUnique` happens outside tx. Verify FK order matches schema.
4. **JWT claim extension is breaking** if older clients don't tolerate extra fields — verify the dashboard JWT parser is permissive.

---

## Amendments applied during execution

> _Empty until execution. Document any divergence here before committing._
