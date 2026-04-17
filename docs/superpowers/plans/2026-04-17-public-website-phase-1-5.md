# Public Website — Phase 1.5 (Public Directory + Contact + i18n) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans`.

**Goal:** Turn the Phase 1 theme placeholders into real pages. Public therapist/specialty directories driven by the backend. Contact form writes to DB. Burnout test ships as static content. Website becomes bilingual via next-intl.

**Architecture:** Phase 1.5 builds on Phase 1's centralized branding and theme system. Three new public endpoints, one mutation endpoint, one admin inbox. All new UI slots into existing `features/` folders and both themes. next-intl replaces hardcoded Arabic strings.

**Tech Stack:** Same as Phase 1 — NestJS 11, Prisma 7, Next.js 15, Tailwind 4, shadcn/ui, next-intl, zod, react-hook-form. New: `@hcaptcha/react-hcaptcha` for anti-spam.

**Reference Spec:** [`docs/superpowers/specs/2026-04-17-public-website-integration-design.md`](../specs/2026-04-17-public-website-integration-design.md) §6 Phase 1.5.

**Branch:** `feat/website-phase-1-5` cut from `main` after Phase 1 is merged.

---

## Conventions (same as Phase 1)

- Every handler gets a colocated `*.handler.spec.ts` (Jest).
- Every frontend feature gets colocated `*.test.ts(x)` (Vitest).
- Commit after each task passes its tests. Conventional commits.
- **Zero hex literals** in app code outside designated token-declaration files.
- `PublicBranding` type remains the single source of truth — do not redefine.
- 350-line cap per file.

---

## Task 0: Prep

- [ ] **0.1** Ensure Phase 1 is merged to `main` and locally pulled.
- [ ] **0.2** `git checkout -b feat/website-phase-1-5` from `main`.
- [ ] **0.3** Ensure Kiwi `CareKit / Website / Manual QA` plan exists (from Phase 1 deferred sync). Create category if missing.
- [ ] **0.4** Read the Sawaa source under `docs/superpowers/assets/sawaa-source/` to identify therapist/specialty/contact/burnout components worth porting (structure + copy, not styling).

---

## Task 1: Prisma — Employee public fields

**Files:**
- Modify: `apps/backend/prisma/schema/people.prisma`
- Create: `apps/backend/prisma/migrations/<ts>_employee_public_fields/migration.sql`

- [ ] **1.1** Add to `model Employee`:
  ```prisma
  slug           String?  @unique
  isPublic       Boolean  @default(false)
  publicBioAr    String?
  publicBioEn    String?
  publicImageUrl String?

  @@index([isPublic])
  ```
- [ ] **1.2** `npx prisma migrate dev --name employee_public_fields`
- [ ] **1.3** Verify SQL is additive (ALTER TABLE ADD COLUMN only).
- [ ] **1.4** Run backend unit tests.
- [ ] **1.5** Commit: `feat(backend): add public fields to Employee`

---

## Task 2: Prisma — Specialty public fields

**Files:**
- Modify: `apps/backend/prisma/schema/people.prisma` (or wherever Specialty lives)
- Create: migration

- [ ] **2.1** Add to `model Specialty`:
  ```prisma
  slug                String?  @unique
  isPublic            Boolean  @default(false)
  publicDescriptionAr String?
  publicDescriptionEn String?
  publicImageUrl      String?

  @@index([isPublic])
  ```
- [ ] **2.2** Migration + verify + tests.
- [ ] **2.3** Commit: `feat(backend): add public fields to Specialty`

---

## Task 3: Prisma — ContactMessage model

**Files:**
- Modify: `apps/backend/prisma/schema/comms.prisma` (or `organization.prisma`)
- Create: migration

- [ ] **3.1** Add new model + enum:
  ```prisma
  enum ContactMessageStatus {
    NEW
    READ
    REPLIED
    ARCHIVED
  }

  model ContactMessage {
    id         String               @id @default(uuid())
    name       String
    phone      String?
    email      String?
    subject    String?
    body       String
    status     ContactMessageStatus @default(NEW)
    createdAt  DateTime             @default(now())
    readAt     DateTime?
    archivedAt DateTime?

    @@index([status, createdAt])
  }
  ```
- [ ] **3.2** Migration + verify + tests.
- [ ] **3.3** Commit: `feat(backend): add ContactMessage model`

---

## Task 4: Backend — ListPublicEmployees handler + controller

**Files:**
- Create: `apps/backend/src/modules/people/employees/public/list-public-employees.handler.ts`
- Create: `apps/backend/src/modules/people/employees/public/list-public-employees.handler.spec.ts`
- Create: `apps/backend/src/modules/people/employees/public/get-public-employee.handler.ts`
- Create: `apps/backend/src/modules/people/employees/public/get-public-employee.handler.spec.ts`
- Create: `apps/backend/src/api/public/employees.controller.ts`
- Create: `apps/backend/src/api/public/employees.controller.spec.ts`
- Modify: relevant module + `public.module.ts`

- [ ] **4.1** Handler `list`: filters `isPublic = true`, returns only public fields + `id` + `slug` + `nameAr/En`. No phone/email leak.
- [ ] **4.2** Handler `get`: lookup by `slug`, 404 if not found or `isPublic = false`.
- [ ] **4.3** Response shape — typed `PublicEmployeeSummary` and `PublicEmployeeDetail` in `@carekit/shared`.
- [ ] **4.4** Controller: `GET /api/v1/public/employees`, `GET /api/v1/public/employees/:slug`. Throttle 30/min.
- [ ] **4.5** Handler + controller specs.
- [ ] **4.6** `openapi:build-and-snapshot`.
- [ ] **4.7** Commit: `feat(backend): GET /public/employees + /public/employees/:slug`

---

## Task 5: Backend — ListPublicSpecialties + GetPublicSpecialty

**Files:** mirror Task 4 structure under `modules/people/specialties/public/` and `api/public/specialties.controller.ts`.

- [ ] **5.1** Same pattern, `isPublic` filter, `slug` lookup.
- [ ] **5.2** `PublicSpecialtySummary` + `PublicSpecialtyDetail` in shared.
- [ ] **5.3** Controller + throttle 30/min.
- [ ] **5.4** Specs + OpenAPI.
- [ ] **5.5** Commit: `feat(backend): GET /public/specialties + /public/specialties/:slug`

---

## Task 6: Backend — CreateContactMessage handler + controller

**Files:**
- Create: `apps/backend/src/modules/comms/contact-messages/create-contact-message.dto.ts`
- Create: `apps/backend/src/modules/comms/contact-messages/create-contact-message.handler.ts` (+ spec)
- Create: `apps/backend/src/api/public/contact-messages.controller.ts` (+ spec)

- [ ] **6.1** DTO: `name` (required), `body` (required, 10-2000 chars), `phone` OR `email` required (custom validator), optional `subject`, `hCaptchaToken`.
- [ ] **6.2** Handler verifies hCaptcha token with hCaptcha's verify API (env var `HCAPTCHA_SECRET`).
- [ ] **6.3** Handler writes to `ContactMessage` with status `NEW`.
- [ ] **6.4** Controller `POST /api/v1/public/contact-messages`. Throttle 3/min per IP.
- [ ] **6.5** Specs cover: happy path, missing contact method, captcha failure, throttle.
- [ ] **6.6** Commit: `feat(backend): POST /public/contact-messages`

---

## Task 7: Backend — Admin contact-messages endpoints

**Files:** under `apps/backend/src/modules/comms/contact-messages/admin/` and `apps/backend/src/api/dashboard/contact-messages.controller.ts`.

- [ ] **7.1** `ListContactMessagesHandler`: pagination + filter by status.
- [ ] **7.2** `UpdateContactMessageStatusHandler`: transitions NEW → READ → REPLIED → ARCHIVED. Sets `readAt` / `archivedAt` timestamps.
- [ ] **7.3** Controller under `/api/v1/dashboard/contact-messages`. Admin auth. CASL ability.
- [ ] **7.4** Specs.
- [ ] **7.5** Commit: `feat(backend): admin contact-messages inbox endpoints`

---

## Task 8: api-client — 6 new endpoints

**Files:**
- Modify: `packages/api-client/src/modules/employees.ts`
- Modify: `packages/api-client/src/modules/specialties.ts`
- Create: `packages/api-client/src/modules/contact-messages.ts`
- Modify: `packages/api-client/src/index.ts` (re-export if needed)

- [ ] **8.1** `getPublicEmployees(): Promise<PublicEmployeeSummary[]>`
- [ ] **8.2** `getPublicEmployee(slug): Promise<PublicEmployeeDetail>`
- [ ] **8.3** `getPublicSpecialties(): Promise<PublicSpecialtySummary[]>`
- [ ] **8.4** `getPublicSpecialty(slug): Promise<PublicSpecialtyDetail>`
- [ ] **8.5** `createContactMessage(payload): Promise<{ id: string }>`
- [ ] **8.6** `getAdminContactMessages(query): Promise<Paginated<ContactMessage>>`
- [ ] **8.7** All types imported from `@carekit/shared`, never redefined.
- [ ] **8.8** Basic vitest mocks per endpoint.
- [ ] **8.9** Commit: `feat(api-client): public directory + contact-messages endpoints`

---

## Task 9: Dashboard — Employee public editor

**Files:**
- Modify: `apps/dashboard/app/(dashboard)/employees/[id]/page.tsx` (add tab)
- Create: `apps/dashboard/components/features/employees/public-profile-tab.tsx`
- Modify: `apps/backend/src/modules/people/employees/update-employee.dto.ts` (accept new fields)
- Modify: employee update handler + spec

- [ ] **9.1** Add "الملف العام" (Public Profile) tab on employee detail page.
- [ ] **9.2** Fields: toggle `isPublic`, `slug` (auto-generated from `nameEn`, editable), `publicBioAr` (textarea), `publicBioEn` (textarea), `publicImageUrl` (upload or URL).
- [ ] **9.3** Slug uniqueness validation (check against other employees, exclude self).
- [ ] **9.4** Save via existing `updateEmployee` mutation — extend DTO.
- [ ] **9.5** Manual test: enable public, visit `/api/v1/public/employees` — employee appears.
- [ ] **9.6** Commit: `feat(dashboard): employee public profile editor`

---

## Task 10: Dashboard — Specialty public editor

Mirror Task 9 for Specialty.

- [ ] **10.1** Tab or section on specialty edit page.
- [ ] **10.2** Fields: `isPublic`, `slug`, `publicDescriptionAr/En`, `publicImageUrl`.
- [ ] **10.3** DTO extension + handler.
- [ ] **10.4** Commit: `feat(dashboard): specialty public profile editor`

---

## Task 11: Dashboard — Contact Messages inbox

**Files:**
- Create: `apps/dashboard/app/(dashboard)/contact-messages/page.tsx`
- Create: `apps/dashboard/components/features/contact-messages/*`
- Create: `apps/dashboard/hooks/use-contact-messages.ts`
- Modify: sidebar nav (add entry)

- [ ] **11.1** List page following dashboard Page Anatomy Law: breadcrumbs, PageHeader, StatsGrid (total, new, read, replied), FilterBar (status filter), DataTable (name, subject preview, status, createdAt).
- [ ] **11.2** Row click → detail sheet with full body + action buttons (Mark Read / Reply externally / Archive).
- [ ] **11.3** Translations.
- [ ] **11.4** Empty state + loading skeletons per dashboard CLAUDE.md.
- [ ] **11.5** Commit: `feat(dashboard): contact messages inbox`

---

## Task 12: Website — features/therapists slice

**Files under `apps/website/features/therapists/`:**
- `therapists.api.ts`, `therapists.types.ts`
- `use-therapists.ts`, `use-therapist.ts`
- `therapist-card.tsx`, `therapists-grid.tsx`
- `public.ts` (barrel)
- `therapists.test.tsx`

**Theme pages:**
- `themes/sawaa/pages/therapists-list.tsx`, `themes/sawaa/pages/therapist-detail.tsx`
- `themes/premium/pages/therapists-list.tsx`, `themes/premium/pages/therapist-detail.tsx`

**Routes:**
- `apps/website/app/therapists/page.tsx`
- `apps/website/app/therapists/[slug]/page.tsx`

- [ ] **12.1** API module uses SSR fetch with `next: { revalidate: 120, tags: ['therapists'] }`.
- [ ] **12.2** Grid/card components use branding CSS variables, no hex.
- [ ] **12.3** Detail page renders bilingual bio (ar by default, switch via locale).
- [ ] **12.4** Empty state when no public therapists.
- [ ] **12.5** Both themes render identical data with different chrome.
- [ ] **12.6** Vitest: renders list from mock data.
- [ ] **12.7** Commit: `feat(website): therapists public directory`

---

## Task 13: Website — features/specialties slice

Mirror Task 12 for specialties.

- [ ] **13.1** Slice files under `features/specialties/`.
- [ ] **13.2** `themes/*/pages/specialties-*.tsx`.
- [ ] **13.3** Routes `app/specialties/page.tsx` + `[slug]`.
- [ ] **13.4** Commit: `feat(website): specialties public directory`

---

## Task 14: Website — features/contact slice

**Files under `features/contact/`:**
- `contact.api.ts`, `contact.schema.ts`, `contact.types.ts`
- `contact-form.tsx` (client component, react-hook-form + zod + hCaptcha)
- `use-submit-contact.ts`
- `public.ts`, `contact-form.test.tsx`

**Theme pages:**
- `themes/sawaa/pages/contact.tsx`, `themes/premium/pages/contact.tsx`

**Route:**
- `apps/website/app/contact/page.tsx`

- [ ] **14.1** Zod schema mirrors backend DTO.
- [ ] **14.2** hCaptcha widget (@hcaptcha/react-hcaptcha). Env var `NEXT_PUBLIC_HCAPTCHA_SITE_KEY`.
- [ ] **14.3** Success state: success message, form resets.
- [ ] **14.4** Error state: toast error, form preserved.
- [ ] **14.5** Dashboard verifies message appears in inbox.
- [ ] **14.6** Commit: `feat(website): contact form`

---

## Task 15: Website — features/burnout-test slice

**Files under `features/burnout-test/`:**
- `questions.ts` (static array, imported from Sawaa source)
- `score.ts` (scoring logic, unit tested)
- `burnout-quiz.tsx`, `burnout-result.tsx`
- `public.ts`, `score.test.ts`, `burnout-quiz.test.tsx`

**Theme pages:**
- `themes/sawaa/pages/burnout.tsx`, `themes/premium/pages/burnout.tsx`

**Route:**
- `apps/website/app/burnout/page.tsx`

- [ ] **15.1** Questions loaded from local TS file, no backend call.
- [ ] **15.2** Score computed client-side; no PII sent to server.
- [ ] **15.3** Result page shows severity band + recommended next step ("book a therapist" CTA to `/therapists`).
- [ ] **15.4** Bilingual; all strings in message files.
- [ ] **15.5** Commit: `feat(website): static burnout self-test`

---

## Task 16: Website — next-intl setup (Arabic default, English switcher)

**Files:**
- Create: `apps/website/i18n.ts` + `i18n/request.ts`
- Create: `apps/website/messages/ar.json`, `messages/en.json`
- Modify: `apps/website/next.config.mjs` (next-intl plugin)
- Modify: `apps/website/middleware.ts` (locale detection + cookie)
- Create: `apps/website/components/language-switcher.tsx`
- Modify: all existing hardcoded Arabic strings across `features/*` and `themes/*` → `useTranslations()`

- [ ] **16.1** Arabic is default; English via visible switcher; choice persisted in cookie `NEXT_LOCALE`.
- [ ] **16.2** No browser-locale auto-detect — Arabic always wins on first visit.
- [ ] **16.3** Message keys namespaced per feature: `therapists.list.title`, `contact.form.name`, etc.
- [ ] **16.4** Both themes import the same messages.
- [ ] **16.5** Manual test: switch to English, reload, remains English. Clear cookie, reload, returns to Arabic.
- [ ] **16.6** Commit: `feat(website): next-intl (Arabic default + English switcher)`

---

## Task 17: QA gate Phase 1.5 + Kiwi sync

**Files:**
- Create: `docs/superpowers/qa/website-phase-1-5-<date>.md`
- Create: `data/kiwi/website-phase-1-5-<date>.json`
- Create: `docs/superpowers/qa/screenshots/website-phase-1-5/`

**Slim manual QA cases (target: ≥6 cases):**

- [ ] **17.1** Public employees page renders 3+ therapists (seed if needed); clicking a card opens detail page with bio.
- [ ] **17.2** Public specialties page renders; slug navigation works.
- [ ] **17.3** Dashboard: toggle employee `isPublic` OFF → therapist disappears from website on next refresh.
- [ ] **17.4** Contact form submits successfully; message appears in dashboard inbox within 5 seconds.
- [ ] **17.5** Invalid contact form (no phone + no email) shows validation error.
- [ ] **17.6** Burnout test: answer 10 questions → result page with score band.
- [ ] **17.7** Language switch ar ↔ en persists across pages.
- [ ] **17.8** Both themes (Sawaa + Premium) render all new pages.
- [ ] **17.9** Sync to Kiwi; commit report.
- [ ] **17.10** Commit: `docs(qa): website phase 1.5 manual QA report`

---

## Self-review before PR

- [ ] Every public endpoint throttled.
- [ ] hCaptcha verified server-side before DB write.
- [ ] No PII leaks through `/public/employees` (phone/email never returned).
- [ ] All new types live in `@carekit/shared`.
- [ ] No hex literals in new `.tsx` / `.ts` outside globals.css.
- [ ] next-intl: zero hardcoded Arabic strings in feature/theme components.
- [ ] OpenAPI snapshot committed.
- [ ] Kiwi sync completed.

---

## Ship criteria (from spec §6 Phase 1.5)

- ✅ Employee/Specialty public fields editable in the dashboard.
- ✅ `/therapists` + `/specialties` pages fetch from `/public/*`.
- ✅ `/contact` writes to `ContactMessage`; inbox visible in dashboard.
- ✅ Burnout test (static) present in both themes.
- ✅ Bilingual ar/en with switcher.

---

## What's explicitly NOT in Phase 1.5

- OTP, booking wizard, payment (Phase 2).
- Client accounts / login (Phase 3).
- SEO schema markup (Phase 4).
- SMS integration (Phase 2+).
- Mobile app branding integration (separate track, not scheduled).
