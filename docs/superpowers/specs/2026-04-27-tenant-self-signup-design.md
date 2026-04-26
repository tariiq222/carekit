# Tenant Self-Signup — Design Spec

**Date:** 2026-04-27  
**Status:** Approved  
**Scope:** New business owners can register, subscribe (free trial), and onboard without super-admin intervention.

---

## 1. Overview

A prospective tenant (clinic owner, salon owner, gym owner, etc.) visits the CareKit dashboard and self-registers. They get a **14-day free trial** immediately — no payment required. After registration they pass through a **4-step onboarding wizard** before seeing the main dashboard. When the trial expires the account moves to `PAST_DUE` and then `SUSPENDED` unless the tenant subscribes.

---

## 2. User Journey

```
/register  →  (backend creates org + user + subscription TRIALING)
           →  /onboarding  (4-step wizard)
                 Step 1: Business name (AR + EN optional) + Vertical selection
                 Step 2: Brand color + Logo upload
                 Step 3: Main branch name + City + Business hours
                 Step 4: Confirmation summary + "Start" button
           →  /(dashboard)/   (main app — trial banner visible)
```

---

## 3. Backend Design

### 3.1 New Endpoint

```
POST /api/v1/public/tenants/register
Rate-limit: 3 req / min per IP
Auth: none (Public)
```

**Input DTO:**

| Field | Type | Required |
|-------|------|----------|
| `name` | string | ✓ |
| `email` | string (email) | ✓ |
| `phone` | string | ✓ |
| `password` | string (min 8, ≥1 uppercase, ≥1 digit) | ✓ |
| `businessNameAr` | string | ✓ |
| `businessNameEn` | string | — |

**Response** (same shape as `/auth/login`):

```json
{
  "accessToken": "...",
  "refreshToken": "...",
  "expiresIn": 900,
  "user": { "id", "email", "name", "organizationId", "isSuperAdmin": false, ... }
}
```

### 3.2 New Slice

```
src/modules/platform/
└── tenant-registration/
    ├── register-tenant.dto.ts
    ├── register-tenant.handler.ts
    └── register-tenant.handler.spec.ts
```

**Transaction (single Prisma `$transaction`):**

1. `Organization.create` — status: `TRIALING`, `trialEndsAt: now + 14d`, slug derived from `businessNameAr` (slugify + collision suffix)
2. `User.create` — role: `OWNER`, hashed password
3. `Membership.create` — `userId`, `organizationId`, `isActive: true`
4. `BrandingConfig.create` — `organizationNameAr: businessNameAr`
5. `OrganizationSettings.create` — defaults (timezone: `Asia/Riyadh`, vatRate: `0.15`)
6. Call `StartSubscriptionHandler.execute({ organizationId, planId: DEFAULT_TRIAL_PLAN_ID })`

After transaction: issue token pair via `TokenService.issueTokenPair()`.

**Idempotency guard:** unique constraint on `User.email` + `Organization.slug` — duplicate registration returns `409 Conflict`.

### 3.3 Wiring

- New controller file: `src/api/public/tenants.controller.ts`
- Register in `PublicModule`

### 3.4 `onboardingCompletedAt` Field

Add nullable `onboardingCompletedAt: DateTime?` to `Organization` model in `platform.prisma`.

New migration: `add_onboarding_completed_at_to_organization`.

Simple endpoint to mark as done:
```
PATCH /api/v1/dashboard/org/mark-onboarded
Auth: JwtGuard (OWNER only)
```
Sets `Organization.onboardingCompletedAt = now()`.

---

## 4. Frontend Design

### 4.1 Register Page

```
app/register/page.tsx                          ← thin page shell
components/features/register-form.tsx          ← form component (≤300 lines)
lib/api/auth.ts                                ← add registerTenant() fn
lib/schemas/register.schema.ts                 ← Zod schema
```

- Standalone route outside `(dashboard)` group — same pattern as `/forgot-password`
- On success: saves tokens via `AuthProvider.login()`, redirects to `/onboarding`
- Link from `/login` page: "مستخدم جديد؟ سجّل الآن"

### 4.2 Onboarding Wizard

```
app/onboarding/page.tsx                         ← wizard orchestrator (≤150 lines)
components/features/onboarding/
├── onboarding-step-1-business.tsx              ← Business name + Vertical picker
├── onboarding-step-2-branding.tsx              ← Color + Logo
├── onboarding-step-3-branch.tsx                ← Branch + Business hours
└── onboarding-step-4-confirm.tsx               ← Summary + Start button
hooks/use-verticals.ts                          ← GET /public/verticals (new hook)
```

**State:** local `useState` in `onboarding/page.tsx` — no global state needed.

**Step → API mapping:**

| Step | API calls |
|------|-----------|
| 1 | `PATCH /dashboard/org-experience/branding` (nameAr/nameEn) + `POST /dashboard/org-config/seed-vertical` |
| 2 | `PATCH /dashboard/org-experience/branding` (primaryColor, logoUrl) |
| 3 | `POST /dashboard/org-config/branches` + `POST /dashboard/org-config/branches/:id/hours` |
| 4 | `PATCH /dashboard/org/mark-onboarded` |

**Auth guard:** `/onboarding` requires valid JWT; redirects to `/login` if none. Uses `useAuth()` from `AuthProvider`.

**Dashboard guard:** `(dashboard)/layout.tsx` checks `user.organization.onboardingCompletedAt`. If `null` → redirect to `/onboarding`.

### 4.3 i18n Keys (AR + EN required)

Namespace: `register.*`, `onboarding.*`

Key examples:
- `register.title`, `register.subtitle`, `register.fields.*`, `register.cta`
- `onboarding.step1.*`, `onboarding.step2.*`, `onboarding.step3.*`, `onboarding.step4.*`
- `onboarding.next`, `onboarding.back`, `onboarding.start`

---

## 5. Trial Expiry Cron

### 5.1 New Slice

```
src/modules/platform/billing/expire-trials/
├── expire-trials.cron.ts
└── expire-trials.cron.spec.ts
```

**Schedule:** every hour (`0 * * * *`)

**Logic:**

```sql
-- Find expired trials
SELECT id FROM "Organization"
WHERE status = 'TRIALING'
  AND "trialEndsAt" < NOW();

-- For each: update org + subscription
UPDATE "Organization" SET status = 'PAST_DUE' WHERE id = $1;
UPDATE "Subscription" SET status = 'PAST_DUE' WHERE "organizationId" = $1;
```

Existing `EnforceGracePeriodCron` then handles `PAST_DUE → SUSPENDED` after the grace period (no change needed there).

---

## 6. Trial Banner

```
components/trial-banner.tsx
```

- Reads `useBilling()` → `subscription.status` + `subscription.trialEndsAt`
- **TRIALING**: shows days remaining (e.g. "باقي 11 يوم في فترتك التجريبية")
- **PAST_DUE / SUSPENDED**: shows warning + "اشترك الآن" button → `/settings/billing`
- **ACTIVE**: renders nothing
- Mounted in `app/(dashboard)/layout.tsx` above main content area

---

## 7. What Does NOT Change

- All existing dashboard endpoints work as-is (wizard reuses them)
- `StartSubscriptionHandler` called as-is (no modifications needed)
- `EnforceGracePeriodCron` works as-is
- No new Prisma models beyond `onboardingCompletedAt` field on `Organization`
- Super-admin org creation flow unchanged

---

## 8. Security Considerations

- Rate-limit on register endpoint (3/min per IP) to prevent org spam
- Password policy enforced: min 8 chars, ≥1 uppercase, ≥1 digit
- Email uniqueness enforced at DB level (existing constraint on `User.email`)
- Slug collision handled with numeric suffix (not exposed to user)
- `mark-onboarded` endpoint restricted to OWNER role only
- No sensitive data in registration response beyond standard auth tokens

---

## 9. Out of Scope (This Phase)

- Email verification on signup (can be added later)
- Payment method collection during trial
- Invite team members during onboarding
- Vertical-specific onboarding customization
- Trial extension by super-admin (exists in billing oversight already)
