# Test Cases — Tenant Self-Signup

**Kiwi TestPlan:** `Deqah / Identity / Manual QA`
**Feature:** Tenant Self-Signup + Onboarding Wizard + Trial Banner

---

## Backend Unit Tests (automated — colocated specs)

### RegisterTenantHandler (`register-tenant.handler.spec.ts`)

| # | Test | Expected |
|---|------|----------|
| 1 | Email already exists (P2002) | Throws `ConflictException` |
| 2 | Default plan not found (PLATFORM_DEFAULT_PLAN_SLUG mismatch) | Throws `NotFoundException` |
| 3 | Happy path: org + user + membership + branding + settings created in single `$transaction` | All 5 creates called; returns `accessToken` + `refreshToken` |
| 4 | `StartSubscriptionHandler.execute()` called after transaction | Called once with `{ billingCycle: 'MONTHLY' }` |
| 5 | Returns tokens from `TokenService.issueTokenPair()` | `{ accessToken: 'at', refreshToken: 'rt' }` |

### ExpireTrialsCron (`expire-trials.cron.spec.ts`)

| # | Test | Expected |
|---|------|----------|
| 1 | `BILLING_CRON_ENABLED=false` | `findMany` not called |
| 2 | No expired trials (empty result) | `updateMany` not called |
| 3 | 2 expired orgs → transition both to `PAST_DUE` | `organization.updateMany` + `subscription.updateMany` called with correct ids |
| 4 | Cache invalidated for each expired org | `cache.invalidate` called N times |

---

## Manual QA (Chrome DevTools MCP)

### TC-001: Register new tenant — happy path

**Precondition:** Backend running on :5100, Dashboard on :5103

**Steps:**
1. Navigate to `http://localhost:5103/register`
2. Fill: Name = "علي أحمد", Email = "ali-test@example.com", Phone = "0501234567", Password = "Pass@1234", Business Name AR = "عيادة علي"
3. Click "إنشاء الحساب"

**Expected:**
- No error displayed
- Redirected to `/onboarding`
- Network: `POST /api/v1/public/tenants/register` → 201 with `accessToken`

---

### TC-002: Register with existing email

**Precondition:** TC-001 already run (email registered)

**Steps:**
1. Navigate to `http://localhost:5103/register`
2. Fill same email as TC-001, different name/password
3. Click "إنشاء الحساب"

**Expected:**
- Error message: "هذا البريد الإلكتروني مسجّل مسبقاً"
- Network: `POST /api/v1/public/tenants/register` → 409

---

### TC-003: Onboarding wizard — complete all 4 steps

**Precondition:** Logged in after TC-001 (at `/onboarding`)

**Steps:**
1. Step 1: Set business name (AR) + select a vertical → click "التالي"
2. Step 2: Choose a color + click "التالي"
3. Step 3: Set branch name + city + enable at least 2 days with hours → click "التالي"
4. Step 4: Click "ابدأ الآن"

**Expected:**
- After step 4: redirected to `/(dashboard)/` (home page)
- Trial banner visible in dashboard layout
- Network: `PATCH /api/v1/dashboard/organization/mark-onboarded` → 204

---

### TC-004: Onboarding redirect guard

**Precondition:** New account created (TC-001) but onboarding NOT completed

**Steps:**
1. Manually navigate to `http://localhost:5103/` (dashboard root)

**Expected:**
- Redirected to `/onboarding`

---

### TC-005: Trial banner — active trial

**Precondition:** TC-003 completed (onboarding done, status = TRIALING)

**Steps:**
1. Open dashboard home page

**Expected:**
- Banner visible with "باقي X يوم في فترتك التجريبية"
- Banner has "اشترك الآن" link → navigates to `/settings/billing`

---

### TC-006: Trial banner — ACTIVE subscription (no banner)

**Precondition:** Existing account with `status = 'ACTIVE'`

**Steps:**
1. Log in as active subscriber, open dashboard

**Expected:**
- No trial banner visible

---

### TC-007: Rate limit enforcement

**Precondition:** Backend running

**Steps:**
1. Send 4 consecutive `POST /api/v1/public/tenants/register` requests within 60 seconds (different emails)

**Expected:**
- First 3 requests succeed (201 or 409)
- 4th request: 429 Too Many Requests

---

### TC-008: Register page — link to login

**Steps:**
1. Navigate to `http://localhost:5103/register`
2. Click "تسجيل الدخول" link

**Expected:**
- Navigated to `/` (login page / dashboard)

---

### TC-009: Password validation

**Steps:**
1. Navigate to `/register`
2. Enter password "short" (< 8 chars) → submit

**Expected:**
- Client-side error: "كلمة المرور 8 أحرف على الأقل"

3. Enter password "alllowercase1" (no uppercase) → submit

**Expected:**
- Client-side error: "يجب أن تحتوي على حرف كبير"

---

### TC-010: Wizard step indicator

**Steps:**
1. Enter onboarding
2. Observe step dots at top of wizard

**Expected:**
- 4 dots; active dots = filled/colored, inactive = muted
- Progresses correctly step → step

---

## Regression Tests (manual — verify no regressions)

| # | Area | Check |
|---|------|-------|
| R-01 | Login | Existing staff login still works (email + password) |
| R-02 | Forgot password | `/forgot-password` still works end-to-end |
| R-03 | Dashboard sidebar | All existing routes still accessible after onboarding |
| R-04 | Billing settings | `/settings/billing` still renders subscription info |
| R-05 | Tenant isolation | New org data not visible to other org users |
