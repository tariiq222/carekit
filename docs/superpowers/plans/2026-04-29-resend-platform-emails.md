# Resend Platform Emails — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `PlatformMailerService` (Resend SDK) that ships eight CareKit-↔-tenant lifecycle emails, leaving the existing `SmtpService` (clinic↔client emails) untouched.

**Architecture:** New service in `apps/backend/src/infrastructure/mail/` exposes one method per email kind (`sendTenantWelcome`, `sendOtpLogin`, `sendTrialEnding`, `sendTrialExpired`, `sendSubscriptionPaymentSucceeded`, `sendSubscriptionPaymentFailed`, `sendPlanChanged`, `sendAccountStatusChanged`). Templates are bilingual AR+EN HTML strings. One additive Prisma migration adds `Subscription.notifiedTrialEndingAt` to dedupe trial-ending notifications. Seven existing handlers each get one new line that calls the mailer; the eighth method (`sendOtpLogin`) is unwired (consumed by a separate super-admin OTP login PR).

**Tech Stack:** NestJS 11, `resend` npm SDK (server-side), Prisma 7, Jest, TypeScript strict.

**Spec:** [`docs/superpowers/specs/2026-04-29-resend-platform-emails-design.md`](../specs/2026-04-29-resend-platform-emails-design.md)

---

## File Structure

**New files:**

- `apps/backend/src/infrastructure/mail/platform-mailer.service.ts` — Resend client, isAvailable, eight `send*` methods.
- `apps/backend/src/infrastructure/mail/platform-mailer.service.spec.ts` — unit tests.
- `apps/backend/src/infrastructure/mail/templates/shared.ts` — `bilingualLayout`, `escapeHtml`, `BRAND` tokens.
- `apps/backend/src/infrastructure/mail/templates/__tests__/shared.spec.ts` — unit tests for shared helpers.
- `apps/backend/src/infrastructure/mail/templates/tenant-welcome.template.ts`
- `apps/backend/src/infrastructure/mail/templates/otp-login.template.ts`
- `apps/backend/src/infrastructure/mail/templates/trial-ending.template.ts`
- `apps/backend/src/infrastructure/mail/templates/trial-expired.template.ts`
- `apps/backend/src/infrastructure/mail/templates/subscription-payment-succeeded.template.ts`
- `apps/backend/src/infrastructure/mail/templates/subscription-payment-failed.template.ts`
- `apps/backend/src/infrastructure/mail/templates/plan-changed.template.ts`
- `apps/backend/src/infrastructure/mail/templates/account-status-changed.template.ts`
- `apps/backend/src/infrastructure/mail/templates/__tests__/templates.spec.ts` — snapshot per template.
- `apps/backend/prisma/migrations/<TIMESTAMP>_add_subscription_notified_trial_ending/migration.sql`

**Modified files:**

- `apps/backend/src/infrastructure/mail/index.ts` — re-export `PlatformMailerService`.
- `apps/backend/src/infrastructure/mail/mail.module.ts` — register provider.
- `apps/backend/prisma/schema/platform.prisma` — add `notifiedTrialEndingAt DateTime?` on `Subscription`.
- `apps/backend/.env.example` — three new vars.
- `apps/backend/src/modules/platform/tenant-registration/register-tenant.handler.ts` — call `sendTenantWelcome` after success.
- `apps/backend/src/modules/platform/tenant-registration/register-tenant.handler.spec.ts` — assert mailer call.
- `apps/backend/src/modules/platform/billing/expire-trials/expire-trials.cron.ts` — send trial-ending + trial-expired.
- `apps/backend/src/modules/platform/billing/expire-trials/expire-trials.cron.spec.ts` — assert mailer calls.
- `apps/backend/src/modules/platform/billing/record-subscription-payment/record-subscription-payment.handler.ts` — send payment-succeeded.
- `apps/backend/src/modules/platform/billing/record-subscription-payment/record-subscription-payment.handler.spec.ts`
- `apps/backend/src/modules/platform/billing/record-subscription-payment-failure/record-subscription-payment-failure.handler.ts` — send payment-failed.
- `apps/backend/src/modules/platform/billing/record-subscription-payment-failure/record-subscription-payment-failure.handler.spec.ts`
- `apps/backend/src/modules/platform/billing/upgrade-plan/upgrade-plan.handler.ts` — send plan-changed.
- `apps/backend/src/modules/platform/billing/upgrade-plan/upgrade-plan.handler.spec.ts`
- `apps/backend/src/modules/platform/billing/downgrade-plan/downgrade-plan.handler.ts` — send plan-changed.
- `apps/backend/src/modules/platform/billing/downgrade-plan/downgrade-plan.handler.spec.ts`
- `apps/backend/src/modules/platform/admin/suspend-organization/suspend-organization.handler.ts` — send account-status (SUSPENDED).
- `apps/backend/src/modules/platform/admin/suspend-organization/suspend-organization.handler.spec.ts`
- `apps/backend/src/modules/platform/admin/reinstate-organization/reinstate-organization.handler.ts` — send account-status (REINSTATED).
- `apps/backend/src/modules/platform/admin/reinstate-organization/reinstate-organization.handler.spec.ts`
- `CLAUDE.md` — document where platform emails live.

---

## Conventions used in this plan

- **CWD for commands** is `apps/backend/` unless explicitly otherwise.
- **Single-test runs:** `npx jest <relative path>` for fast feedback. Full suite is `npx jest` from `apps/backend/`.
- **Commits** are conventional, scoped (`feat(mailer): …`, `feat(billing): …`, `chore(deps): …`).
- **No `any`:** strict TS everywhere. Templates expose typed `Vars` interfaces.
- **Mocking the SDK:** the `resend` package exposes `Resend` class with `.emails.send({...})`. We mock via `jest.mock('resend', …)` so no network calls happen in tests.
- **CLS / tenant context:** none of these handlers care; we pass `organizationId` explicitly via the trigger handler.

---

## Task 0: Add `resend` dependency

**Files:**
- Modify: `apps/backend/package.json`

- [ ] **Step 1: Add the dep**

```bash
cd apps/backend
npm install resend@^6.0.0
```

- [ ] **Step 2: Verify it landed**

```bash
node -e "console.log(require('resend/package.json').version)"
```

Expected: a version string starting with `6.`.

- [ ] **Step 3: Commit**

```bash
git add apps/backend/package.json ../../package-lock.json
git commit -m "chore(deps): add resend@^6 to backend"
```

---

## Task 1: Shared template helpers (`templates/shared.ts`)

**Files:**
- Create: `apps/backend/src/infrastructure/mail/templates/shared.ts`
- Create: `apps/backend/src/infrastructure/mail/templates/__tests__/shared.spec.ts`

- [ ] **Step 1: Write the failing test**

`apps/backend/src/infrastructure/mail/templates/__tests__/shared.spec.ts`:

```ts
import { bilingualLayout, escapeHtml, BRAND } from '../shared';

describe('escapeHtml', () => {
  it('escapes the five HTML metacharacters', () => {
    expect(escapeHtml(`<a href="x" onerror='b()'>&</a>`)).toBe(
      '&lt;a href=&quot;x&quot; onerror=&#39;b()&#39;&gt;&amp;&lt;/a&gt;',
    );
  });

  it('returns empty string unchanged', () => {
    expect(escapeHtml('')).toBe('');
  });
});

describe('BRAND', () => {
  it('exposes the CareKit primary color and font', () => {
    expect(BRAND.primary).toBe('#354FD8');
    expect(BRAND.fontFamily).toMatch(/IBM Plex Sans Arabic/);
  });
});

describe('bilingualLayout', () => {
  it('wraps AR + EN halves and respects dir attributes', () => {
    const html = bilingualLayout({ ar: '<p>مرحبا</p>', en: '<p>Hello</p>' });
    expect(html).toMatch(/<!DOCTYPE html>/);
    expect(html).toMatch(/dir="rtl"/);
    expect(html).toMatch(/dir="ltr"/);
    expect(html).toContain('<p>مرحبا</p>');
    expect(html).toContain('<p>Hello</p>');
    // AR half precedes EN half
    expect(html.indexOf('مرحبا')).toBeLessThan(html.indexOf('Hello'));
  });
});
```

- [ ] **Step 2: Run test → expect FAIL**

```bash
cd apps/backend
npx jest src/infrastructure/mail/templates/__tests__/shared.spec.ts
```

Expected: FAIL with `Cannot find module '../shared'`.

- [ ] **Step 3: Implement `shared.ts`**

`apps/backend/src/infrastructure/mail/templates/shared.ts`:

```ts
/**
 * Brand tokens for platform emails. Hard-coded — these emails are CareKit
 * platform identity, not per-tenant branding.
 */
export const BRAND = {
  primary: '#354FD8',
  accent: '#82CC17',
  textBody: '#333333',
  textMuted: '#888888',
  surface: '#F5F7FA',
  fontFamily: "'IBM Plex Sans Arabic', Arial, sans-serif",
} as const;

/**
 * Single source of truth for HTML escaping in email templates.
 * Replaces the inline `escape()` previously duplicated in
 * `reset-user-password.handler.ts`.
 */
export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export interface BilingualSections {
  /** Arabic body — already-trusted HTML; callers escape vars before passing. */
  ar: string;
  /** English body — already-trusted HTML; callers escape vars before passing. */
  en: string;
}

/**
 * Wraps two pre-rendered language halves in a single brand-styled HTML doc.
 * AR comes first (RTL, primary), EN below (LTR, secondary). Use one
 * `<table>`-based outer to maximise inbox renderer compatibility.
 */
export function bilingualLayout({ ar, en }: BilingualSections): string {
  return `<!DOCTYPE html>
<html lang="ar">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>CareKit</title>
</head>
<body style="margin:0;padding:24px;background:${BRAND.surface};font-family:${BRAND.fontFamily};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;">
<tr><td dir="rtl" style="padding:32px 28px;">${ar}</td></tr>
<tr><td style="border-top:1px solid #eee;"></td></tr>
<tr><td dir="ltr" style="padding:32px 28px;">${en}</td></tr>
</table>
</body>
</html>`;
}
```

- [ ] **Step 4: Run test → expect PASS**

```bash
npx jest src/infrastructure/mail/templates/__tests__/shared.spec.ts
```

Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/infrastructure/mail/templates/shared.ts apps/backend/src/infrastructure/mail/templates/__tests__/shared.spec.ts
git commit -m "feat(mailer): bilingual layout + escape helpers for platform emails"
```

---

## Task 2: Eight email templates

For each of the eight templates, follow the same micro-pattern: write the typed Vars interface + the function returning `{ subjectAr, subjectEn, html }`, then add a snapshot test.

**Files (create together in this task):**
- Create: `apps/backend/src/infrastructure/mail/templates/tenant-welcome.template.ts`
- Create: `apps/backend/src/infrastructure/mail/templates/otp-login.template.ts`
- Create: `apps/backend/src/infrastructure/mail/templates/trial-ending.template.ts`
- Create: `apps/backend/src/infrastructure/mail/templates/trial-expired.template.ts`
- Create: `apps/backend/src/infrastructure/mail/templates/subscription-payment-succeeded.template.ts`
- Create: `apps/backend/src/infrastructure/mail/templates/subscription-payment-failed.template.ts`
- Create: `apps/backend/src/infrastructure/mail/templates/plan-changed.template.ts`
- Create: `apps/backend/src/infrastructure/mail/templates/account-status-changed.template.ts`
- Create: `apps/backend/src/infrastructure/mail/templates/__tests__/templates.spec.ts`

- [ ] **Step 1: Write the failing test**

`apps/backend/src/infrastructure/mail/templates/__tests__/templates.spec.ts`:

```ts
import { tenantWelcomeTemplate } from '../tenant-welcome.template';
import { otpLoginTemplate } from '../otp-login.template';
import { trialEndingTemplate } from '../trial-ending.template';
import { trialExpiredTemplate } from '../trial-expired.template';
import { subscriptionPaymentSucceededTemplate } from '../subscription-payment-succeeded.template';
import { subscriptionPaymentFailedTemplate } from '../subscription-payment-failed.template';
import { planChangedTemplate } from '../plan-changed.template';
import { accountStatusChangedTemplate } from '../account-status-changed.template';

describe('platform email templates', () => {
  it('tenantWelcome renders both languages, escapes name', () => {
    const out = tenantWelcomeTemplate({
      ownerName: '<script>alert(1)</script>',
      orgName: 'Sawa',
      dashboardUrl: 'https://app.example/dashboard',
    });
    expect(out.subjectAr).toContain('CareKit');
    expect(out.subjectEn).toContain('CareKit');
    expect(out.html).toContain('Sawa');
    expect(out.html).toContain('https://app.example/dashboard');
    expect(out.html).not.toContain('<script>alert(1)</script>');
    expect(out.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('otpLogin includes the code and expiry, code is digit-only', () => {
    const out = otpLoginTemplate({ code: '482913', expiresInMinutes: 10 });
    expect(out.html).toContain('482913');
    expect(out.html).toContain('10');
    expect(out.subjectAr).toContain('رمز');
    expect(out.subjectEn).toMatch(/code/i);
  });

  it('trialEnding shows daysLeft + upgrade URL', () => {
    const out = trialEndingTemplate({
      ownerName: 'Tariq',
      orgName: 'Sawa',
      daysLeft: 3,
      upgradeUrl: 'https://app.example/billing',
    });
    expect(out.html).toContain('Tariq');
    expect(out.html).toContain('3');
    expect(out.html).toContain('https://app.example/billing');
  });

  it('trialExpired surfaces the upgrade URL prominently', () => {
    const out = trialExpiredTemplate({
      ownerName: 'Tariq',
      orgName: 'Sawa',
      upgradeUrl: 'https://app.example/billing',
    });
    expect(out.html).toContain('https://app.example/billing');
  });

  it('paymentSucceeded includes amount + currency + invoiceId', () => {
    const out = subscriptionPaymentSucceededTemplate({
      ownerName: 'Tariq',
      orgName: 'Sawa',
      amountSar: '299.00',
      invoiceId: 'inv_123',
      receiptUrl: 'https://app.example/billing/inv_123',
    });
    expect(out.html).toContain('299.00');
    expect(out.html).toContain('SAR');
    expect(out.html).toContain('inv_123');
    expect(out.html).toContain('https://app.example/billing/inv_123');
  });

  it('paymentFailed shows reason and retry guidance', () => {
    const out = subscriptionPaymentFailedTemplate({
      ownerName: 'Tariq',
      orgName: 'Sawa',
      amountSar: '299.00',
      reason: 'Card declined',
      billingUrl: 'https://app.example/billing',
    });
    expect(out.html).toContain('Card declined');
    expect(out.html).toContain('https://app.example/billing');
  });

  it('planChanged describes from/to', () => {
    const out = planChangedTemplate({
      ownerName: 'Tariq',
      orgName: 'Sawa',
      fromPlanName: 'Basic',
      toPlanName: 'Pro',
      effectiveDate: new Date('2026-05-01').toISOString(),
    });
    expect(out.html).toContain('Basic');
    expect(out.html).toContain('Pro');
  });

  it('accountStatusChanged renders SUSPENDED and REINSTATED variants', () => {
    const suspended = accountStatusChangedTemplate({
      ownerName: 'Tariq',
      orgName: 'Sawa',
      status: 'SUSPENDED',
      reason: 'Outstanding invoice',
      contactUrl: 'mailto:support@webvue.pro',
    });
    expect(suspended.html).toContain('Outstanding invoice');
    expect(suspended.subjectEn.toLowerCase()).toContain('suspended');

    const reinstated = accountStatusChangedTemplate({
      ownerName: 'Tariq',
      orgName: 'Sawa',
      status: 'REINSTATED',
      reason: undefined,
      contactUrl: 'https://app.example/dashboard',
    });
    expect(reinstated.subjectEn.toLowerCase()).toContain('reinstated');
  });
});
```

- [ ] **Step 2: Run test → expect FAIL (cannot find modules)**

```bash
npx jest src/infrastructure/mail/templates/__tests__/templates.spec.ts
```

Expected: 8 failures (cannot find each template module).

- [ ] **Step 3: Implement `tenant-welcome.template.ts`**

```ts
import { bilingualLayout, escapeHtml, BRAND } from './shared';

export interface TenantWelcomeVars {
  ownerName: string;
  orgName: string;
  dashboardUrl: string;
}

export function tenantWelcomeTemplate(vars: TenantWelcomeVars): {
  subjectAr: string;
  subjectEn: string;
  html: string;
} {
  const name = escapeHtml(vars.ownerName);
  const org = escapeHtml(vars.orgName);
  const url = escapeHtml(vars.dashboardUrl);

  const ar = `
    <h1 style="color:${BRAND.primary};font-size:22px;margin:0 0 16px;">أهلاً ${name} 👋</h1>
    <p style="color:${BRAND.textBody};font-size:15px;line-height:1.7;">
      شكرًا لانضمامك إلى CareKit. حسابك "${org}" جاهز، ومدّة التجربة المجانية ١٤ يومًا.
    </p>
    <p style="text-align:center;margin:28px 0;">
      <a href="${url}" style="display:inline-block;background:${BRAND.primary};color:#fff;padding:14px 28px;border-radius:12px;text-decoration:none;font-weight:600;">افتح لوحة التحكم</a>
    </p>
  `;

  const en = `
    <h1 style="color:${BRAND.primary};font-size:22px;margin:0 0 16px;">Welcome, ${name} 👋</h1>
    <p style="color:${BRAND.textBody};font-size:15px;line-height:1.7;">
      Thanks for joining CareKit. Your "${org}" workspace is ready and your 14-day free trial has started.
    </p>
    <p style="text-align:center;margin:28px 0;">
      <a href="${url}" style="display:inline-block;background:${BRAND.primary};color:#fff;padding:14px 28px;border-radius:12px;text-decoration:none;font-weight:600;">Open Dashboard</a>
    </p>
  `;

  return {
    subjectAr: 'مرحبًا بك في CareKit',
    subjectEn: 'Welcome to CareKit',
    html: bilingualLayout({ ar, en }),
  };
}
```

- [ ] **Step 4: Implement `otp-login.template.ts`**

```ts
import { bilingualLayout, escapeHtml, BRAND } from './shared';

export interface OtpLoginVars {
  code: string;
  expiresInMinutes: number;
}

export function otpLoginTemplate(vars: OtpLoginVars): {
  subjectAr: string;
  subjectEn: string;
  html: string;
} {
  const code = escapeHtml(vars.code);
  const mins = Math.max(1, Math.floor(vars.expiresInMinutes));

  const codeBlock = `
    <div style="background:${BRAND.surface};border-radius:12px;padding:24px;margin:24px 0;text-align:center;">
      <span style="font-size:32px;font-weight:700;letter-spacing:8px;color:${BRAND.primary};font-family:monospace;">${code}</span>
    </div>
  `;

  const ar = `
    <h1 style="color:${BRAND.primary};font-size:20px;margin:0 0 12px;">رمز تسجيل الدخول</h1>
    <p style="color:${BRAND.textBody};font-size:15px;">استخدم الرمز التالي لإكمال تسجيل الدخول:</p>
    ${codeBlock}
    <p style="color:${BRAND.textMuted};font-size:13px;">سينتهي الرمز خلال ${mins} دقيقة.</p>
  `;
  const en = `
    <h1 style="color:${BRAND.primary};font-size:20px;margin:0 0 12px;">Your login code</h1>
    <p style="color:${BRAND.textBody};font-size:15px;">Use the code below to finish signing in:</p>
    ${codeBlock}
    <p style="color:${BRAND.textMuted};font-size:13px;">This code expires in ${mins} minute${mins === 1 ? '' : 's'}.</p>
  `;

  return {
    subjectAr: 'رمز تسجيل الدخول إلى CareKit',
    subjectEn: 'Your CareKit login code',
    html: bilingualLayout({ ar, en }),
  };
}
```

- [ ] **Step 5: Implement `trial-ending.template.ts`**

```ts
import { bilingualLayout, escapeHtml, BRAND } from './shared';

export interface TrialEndingVars {
  ownerName: string;
  orgName: string;
  daysLeft: number;
  upgradeUrl: string;
}

export function trialEndingTemplate(vars: TrialEndingVars): {
  subjectAr: string;
  subjectEn: string;
  html: string;
} {
  const name = escapeHtml(vars.ownerName);
  const org = escapeHtml(vars.orgName);
  const url = escapeHtml(vars.upgradeUrl);
  const days = Math.max(0, Math.floor(vars.daysLeft));

  const ar = `
    <h1 style="color:${BRAND.primary};font-size:20px;margin:0 0 12px;">${name}، تجربتك على وشك الانتهاء</h1>
    <p style="color:${BRAND.textBody};font-size:15px;line-height:1.7;">
      تبقّى ${days} ${days === 1 ? 'يوم' : 'أيام'} على انتهاء التجربة المجانية لحساب "${org}". اختر باقة لتستمر بدون انقطاع.
    </p>
    <p style="text-align:center;margin:28px 0;">
      <a href="${url}" style="display:inline-block;background:${BRAND.primary};color:#fff;padding:14px 28px;border-radius:12px;text-decoration:none;font-weight:600;">اختيار باقة</a>
    </p>
  `;
  const en = `
    <h1 style="color:${BRAND.primary};font-size:20px;margin:0 0 12px;">${name}, your trial is ending soon</h1>
    <p style="color:${BRAND.textBody};font-size:15px;line-height:1.7;">
      You have ${days} day${days === 1 ? '' : 's'} left on your "${org}" free trial. Pick a plan to keep things running.
    </p>
    <p style="text-align:center;margin:28px 0;">
      <a href="${url}" style="display:inline-block;background:${BRAND.primary};color:#fff;padding:14px 28px;border-radius:12px;text-decoration:none;font-weight:600;">Choose a plan</a>
    </p>
  `;

  return {
    subjectAr: `تجربة CareKit تنتهي خلال ${days} ${days === 1 ? 'يوم' : 'أيام'}`,
    subjectEn: `Your CareKit trial ends in ${days} day${days === 1 ? '' : 's'}`,
    html: bilingualLayout({ ar, en }),
  };
}
```

- [ ] **Step 6: Implement `trial-expired.template.ts`**

```ts
import { bilingualLayout, escapeHtml, BRAND } from './shared';

export interface TrialExpiredVars {
  ownerName: string;
  orgName: string;
  upgradeUrl: string;
}

export function trialExpiredTemplate(vars: TrialExpiredVars): {
  subjectAr: string;
  subjectEn: string;
  html: string;
} {
  const name = escapeHtml(vars.ownerName);
  const org = escapeHtml(vars.orgName);
  const url = escapeHtml(vars.upgradeUrl);

  const ar = `
    <h1 style="color:${BRAND.primary};font-size:20px;margin:0 0 12px;">${name}، انتهت التجربة</h1>
    <p style="color:${BRAND.textBody};font-size:15px;line-height:1.7;">
      انتهت التجربة المجانية لـ "${org}". اختر باقة الآن لاستعادة الوصول.
    </p>
    <p style="text-align:center;margin:28px 0;">
      <a href="${url}" style="display:inline-block;background:${BRAND.primary};color:#fff;padding:14px 28px;border-radius:12px;text-decoration:none;font-weight:600;">اختيار باقة</a>
    </p>
  `;
  const en = `
    <h1 style="color:${BRAND.primary};font-size:20px;margin:0 0 12px;">${name}, your trial has ended</h1>
    <p style="color:${BRAND.textBody};font-size:15px;line-height:1.7;">
      The free trial for "${org}" has expired. Pick a plan to restore access.
    </p>
    <p style="text-align:center;margin:28px 0;">
      <a href="${url}" style="display:inline-block;background:${BRAND.primary};color:#fff;padding:14px 28px;border-radius:12px;text-decoration:none;font-weight:600;">Choose a plan</a>
    </p>
  `;

  return {
    subjectAr: 'انتهت تجربة CareKit',
    subjectEn: 'Your CareKit trial has ended',
    html: bilingualLayout({ ar, en }),
  };
}
```

- [ ] **Step 7: Implement `subscription-payment-succeeded.template.ts`**

```ts
import { bilingualLayout, escapeHtml, BRAND } from './shared';

export interface SubscriptionPaymentSucceededVars {
  ownerName: string;
  orgName: string;
  /** Amount as a pre-formatted decimal string, e.g. "299.00". */
  amountSar: string;
  invoiceId: string;
  receiptUrl: string;
}

export function subscriptionPaymentSucceededTemplate(
  vars: SubscriptionPaymentSucceededVars,
): { subjectAr: string; subjectEn: string; html: string } {
  const name = escapeHtml(vars.ownerName);
  const org = escapeHtml(vars.orgName);
  const amount = escapeHtml(vars.amountSar);
  const invoice = escapeHtml(vars.invoiceId);
  const url = escapeHtml(vars.receiptUrl);

  const ar = `
    <h1 style="color:${BRAND.primary};font-size:20px;margin:0 0 12px;">${name}، تم استلام الدفع ✅</h1>
    <p style="color:${BRAND.textBody};font-size:15px;line-height:1.7;">
      تم خصم <strong>${amount} SAR</strong> لاشتراك "${org}". رقم الفاتورة <code>${invoice}</code>.
    </p>
    <p style="text-align:center;margin:28px 0;">
      <a href="${url}" style="display:inline-block;background:${BRAND.primary};color:#fff;padding:12px 24px;border-radius:12px;text-decoration:none;font-weight:600;">عرض الإيصال</a>
    </p>
  `;
  const en = `
    <h1 style="color:${BRAND.primary};font-size:20px;margin:0 0 12px;">${name}, payment received ✅</h1>
    <p style="color:${BRAND.textBody};font-size:15px;line-height:1.7;">
      <strong>${amount} SAR</strong> was charged for your "${org}" subscription. Invoice <code>${invoice}</code>.
    </p>
    <p style="text-align:center;margin:28px 0;">
      <a href="${url}" style="display:inline-block;background:${BRAND.primary};color:#fff;padding:12px 24px;border-radius:12px;text-decoration:none;font-weight:600;">View receipt</a>
    </p>
  `;

  return {
    subjectAr: 'تم استلام دفع اشتراك CareKit',
    subjectEn: 'CareKit subscription payment received',
    html: bilingualLayout({ ar, en }),
  };
}
```

- [ ] **Step 8: Implement `subscription-payment-failed.template.ts`**

```ts
import { bilingualLayout, escapeHtml, BRAND } from './shared';

export interface SubscriptionPaymentFailedVars {
  ownerName: string;
  orgName: string;
  /** Amount as a pre-formatted decimal string, e.g. "299.00". */
  amountSar: string;
  /** Provider-supplied failure reason, e.g. "Card declined". */
  reason: string;
  billingUrl: string;
}

export function subscriptionPaymentFailedTemplate(
  vars: SubscriptionPaymentFailedVars,
): { subjectAr: string; subjectEn: string; html: string } {
  const name = escapeHtml(vars.ownerName);
  const org = escapeHtml(vars.orgName);
  const amount = escapeHtml(vars.amountSar);
  const reason = escapeHtml(vars.reason);
  const url = escapeHtml(vars.billingUrl);

  const ar = `
    <h1 style="color:#B91C1C;font-size:20px;margin:0 0 12px;">${name}، تعذّرت عملية الدفع</h1>
    <p style="color:${BRAND.textBody};font-size:15px;line-height:1.7;">
      حاولنا خصم <strong>${amount} SAR</strong> لاشتراك "${org}" ولم تنجح العملية.
      السبب: ${reason}.
    </p>
    <p style="text-align:center;margin:28px 0;">
      <a href="${url}" style="display:inline-block;background:${BRAND.primary};color:#fff;padding:12px 24px;border-radius:12px;text-decoration:none;font-weight:600;">تحديث طريقة الدفع</a>
    </p>
  `;
  const en = `
    <h1 style="color:#B91C1C;font-size:20px;margin:0 0 12px;">${name}, payment failed</h1>
    <p style="color:${BRAND.textBody};font-size:15px;line-height:1.7;">
      We tried to charge <strong>${amount} SAR</strong> for your "${org}" subscription and it didn't go through.
      Reason: ${reason}.
    </p>
    <p style="text-align:center;margin:28px 0;">
      <a href="${url}" style="display:inline-block;background:${BRAND.primary};color:#fff;padding:12px 24px;border-radius:12px;text-decoration:none;font-weight:600;">Update payment method</a>
    </p>
  `;

  return {
    subjectAr: 'فشل دفع اشتراك CareKit',
    subjectEn: 'CareKit subscription payment failed',
    html: bilingualLayout({ ar, en }),
  };
}
```

- [ ] **Step 9: Implement `plan-changed.template.ts`**

```ts
import { bilingualLayout, escapeHtml, BRAND } from './shared';

export interface PlanChangedVars {
  ownerName: string;
  orgName: string;
  fromPlanName: string;
  toPlanName: string;
  /** ISO-8601 string. The template formats to YYYY-MM-DD only. */
  effectiveDate: string;
}

export function planChangedTemplate(vars: PlanChangedVars): {
  subjectAr: string;
  subjectEn: string;
  html: string;
} {
  const name = escapeHtml(vars.ownerName);
  const org = escapeHtml(vars.orgName);
  const from = escapeHtml(vars.fromPlanName);
  const to = escapeHtml(vars.toPlanName);
  const date = escapeHtml(vars.effectiveDate.slice(0, 10));

  const ar = `
    <h1 style="color:${BRAND.primary};font-size:20px;margin:0 0 12px;">${name}، تم تحديث الباقة</h1>
    <p style="color:${BRAND.textBody};font-size:15px;line-height:1.7;">
      تم نقل اشتراك "${org}" من <strong>${from}</strong> إلى <strong>${to}</strong>، اعتبارًا من ${date}.
    </p>
  `;
  const en = `
    <h1 style="color:${BRAND.primary};font-size:20px;margin:0 0 12px;">${name}, your plan was updated</h1>
    <p style="color:${BRAND.textBody};font-size:15px;line-height:1.7;">
      Your "${org}" subscription moved from <strong>${from}</strong> to <strong>${to}</strong>, effective ${date}.
    </p>
  `;

  return {
    subjectAr: 'تم تحديث باقة اشتراك CareKit',
    subjectEn: 'Your CareKit plan changed',
    html: bilingualLayout({ ar, en }),
  };
}
```

- [ ] **Step 10: Implement `account-status-changed.template.ts`**

```ts
import { bilingualLayout, escapeHtml, BRAND } from './shared';

export type AccountStatusKind = 'SUSPENDED' | 'REINSTATED';

export interface AccountStatusChangedVars {
  ownerName: string;
  orgName: string;
  status: AccountStatusKind;
  /** Optional human reason. Required for SUSPENDED, optional for REINSTATED. */
  reason?: string;
  /** Where the user can take action — billing page or support contact. */
  contactUrl: string;
}

export function accountStatusChangedTemplate(vars: AccountStatusChangedVars): {
  subjectAr: string;
  subjectEn: string;
  html: string;
} {
  const name = escapeHtml(vars.ownerName);
  const org = escapeHtml(vars.orgName);
  const url = escapeHtml(vars.contactUrl);
  const reason = vars.reason ? escapeHtml(vars.reason) : null;

  if (vars.status === 'SUSPENDED') {
    const ar = `
      <h1 style="color:#B91C1C;font-size:20px;margin:0 0 12px;">${name}، تم تعليق الحساب</h1>
      <p style="color:${BRAND.textBody};font-size:15px;line-height:1.7;">
        تم تعليق حساب "${org}". ${reason ? `السبب: ${reason}.` : ''}
      </p>
      <p style="text-align:center;margin:28px 0;">
        <a href="${url}" style="display:inline-block;background:${BRAND.primary};color:#fff;padding:12px 24px;border-radius:12px;text-decoration:none;font-weight:600;">التواصل مع الدعم</a>
      </p>
    `;
    const en = `
      <h1 style="color:#B91C1C;font-size:20px;margin:0 0 12px;">${name}, your account was suspended</h1>
      <p style="color:${BRAND.textBody};font-size:15px;line-height:1.7;">
        Account "${org}" has been suspended. ${reason ? `Reason: ${reason}.` : ''}
      </p>
      <p style="text-align:center;margin:28px 0;">
        <a href="${url}" style="display:inline-block;background:${BRAND.primary};color:#fff;padding:12px 24px;border-radius:12px;text-decoration:none;font-weight:600;">Contact support</a>
      </p>
    `;
    return {
      subjectAr: 'تم تعليق حساب CareKit',
      subjectEn: 'Your CareKit account was suspended',
      html: bilingualLayout({ ar, en }),
    };
  }

  // REINSTATED
  const ar = `
    <h1 style="color:${BRAND.primary};font-size:20px;margin:0 0 12px;">${name}، تم إعادة تفعيل الحساب</h1>
    <p style="color:${BRAND.textBody};font-size:15px;line-height:1.7;">
      تم إعادة تفعيل حساب "${org}". مرحبًا بعودتك.
    </p>
    <p style="text-align:center;margin:28px 0;">
      <a href="${url}" style="display:inline-block;background:${BRAND.primary};color:#fff;padding:12px 24px;border-radius:12px;text-decoration:none;font-weight:600;">افتح لوحة التحكم</a>
    </p>
  `;
  const en = `
    <h1 style="color:${BRAND.primary};font-size:20px;margin:0 0 12px;">${name}, your account was reinstated</h1>
    <p style="color:${BRAND.textBody};font-size:15px;line-height:1.7;">
      "${org}" is active again. Welcome back.
    </p>
    <p style="text-align:center;margin:28px 0;">
      <a href="${url}" style="display:inline-block;background:${BRAND.primary};color:#fff;padding:12px 24px;border-radius:12px;text-decoration:none;font-weight:600;">Open Dashboard</a>
    </p>
  `;
  return {
    subjectAr: 'تم إعادة تفعيل حساب CareKit',
    subjectEn: 'Your CareKit account was reinstated',
    html: bilingualLayout({ ar, en }),
  };
}
```

- [ ] **Step 11: Run tests → expect PASS**

```bash
npx jest src/infrastructure/mail/templates/__tests__/templates.spec.ts
```

Expected: PASS, 8 tests.

- [ ] **Step 12: Commit**

```bash
git add apps/backend/src/infrastructure/mail/templates/
git commit -m "feat(mailer): eight bilingual platform email templates"
```

---

## Task 3: `PlatformMailerService` skeleton + `isAvailable` + module wiring

**Files:**
- Create: `apps/backend/src/infrastructure/mail/platform-mailer.service.ts`
- Create: `apps/backend/src/infrastructure/mail/platform-mailer.service.spec.ts`
- Modify: `apps/backend/src/infrastructure/mail/index.ts`
- Modify: `apps/backend/src/infrastructure/mail/mail.module.ts`

- [ ] **Step 1: Write the failing test**

`apps/backend/src/infrastructure/mail/platform-mailer.service.spec.ts`:

```ts
import { ConfigService } from '@nestjs/config';
import { PlatformMailerService } from './platform-mailer.service';

const mockSend = jest.fn();
jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: { send: mockSend },
  })),
}));

function configWith(env: Record<string, string | undefined>): ConfigService {
  return {
    get: <T>(key: string, fallback?: T) =>
      (env[key] as unknown as T) ?? fallback,
  } as ConfigService;
}

describe('PlatformMailerService — bootstrap', () => {
  beforeEach(() => {
    mockSend.mockReset();
    delete process.env.NODE_ENV;
  });

  it('isAvailable() = false in dev when RESEND_API_KEY is missing', () => {
    process.env.NODE_ENV = 'development';
    const svc = new PlatformMailerService(configWith({}));
    svc.onModuleInit();
    expect(svc.isAvailable()).toBe(false);
  });

  it('isAvailable() = true when RESEND_API_KEY is present', () => {
    const svc = new PlatformMailerService(configWith({ RESEND_API_KEY: 're_test' }));
    svc.onModuleInit();
    expect(svc.isAvailable()).toBe(true);
  });

  it('throws on bootstrap in production when RESEND_API_KEY is missing', () => {
    process.env.NODE_ENV = 'production';
    const svc = new PlatformMailerService(configWith({}));
    expect(() => svc.onModuleInit()).toThrow(/RESEND_API_KEY/);
  });
});
```

- [ ] **Step 2: Run test → expect FAIL**

```bash
npx jest src/infrastructure/mail/platform-mailer.service.spec.ts
```

Expected: FAIL — `Cannot find module './platform-mailer.service'`.

- [ ] **Step 3: Implement the skeleton**

`apps/backend/src/infrastructure/mail/platform-mailer.service.ts`:

```ts
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

const DEFAULT_FROM = 'CareKit <noreply@webvue.pro>';
const DEFAULT_REPLY_TO = 'support@webvue.pro';

@Injectable()
export class PlatformMailerService implements OnModuleInit {
  private readonly logger = new Logger(PlatformMailerService.name);
  private client: Resend | null = null;
  private from = DEFAULT_FROM;
  private replyTo = DEFAULT_REPLY_TO;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const apiKey = this.config.get<string>('RESEND_API_KEY');
    this.from = this.config.get<string>('RESEND_FROM') ?? DEFAULT_FROM;
    this.replyTo = this.config.get<string>('RESEND_REPLY_TO') ?? DEFAULT_REPLY_TO;

    if (!apiKey) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('RESEND_API_KEY is required in production');
      }
      this.logger.warn(
        'RESEND_API_KEY not set — platform mail disabled (dev/test mode).',
      );
      return;
    }

    this.client = new Resend(apiKey);
    this.logger.log('PlatformMailerService initialized');
  }

  isAvailable(): boolean {
    return this.client !== null;
  }
}
```

- [ ] **Step 4: Run test → expect PASS**

```bash
npx jest src/infrastructure/mail/platform-mailer.service.spec.ts
```

Expected: PASS, 3 tests.

- [ ] **Step 5: Wire into `MailModule` + index**

`apps/backend/src/infrastructure/mail/mail.module.ts` — full file:

```ts
import { Global, Module } from '@nestjs/common';
import { FcmService } from './fcm.service';
import { SmtpService } from './smtp.service';
import { PlatformMailerService } from './platform-mailer.service';

@Global()
@Module({
  providers: [FcmService, SmtpService, PlatformMailerService],
  exports: [FcmService, SmtpService, PlatformMailerService],
})
export class MailModule {}
```

`apps/backend/src/infrastructure/mail/index.ts` — full file:

```ts
export { FcmService, IFcmService } from './fcm.service';
export { SmtpService, ISmtpService } from './smtp.service';
export { PlatformMailerService } from './platform-mailer.service';
export { MailModule } from './mail.module';
```

- [ ] **Step 6: Confirm app boots (typecheck) and full unit suite passes**

```bash
npm run typecheck
npx jest --silent
```

Expected: typecheck clean; jest 100% pass.

- [ ] **Step 7: Commit**

```bash
git add apps/backend/src/infrastructure/mail/platform-mailer.service.ts apps/backend/src/infrastructure/mail/platform-mailer.service.spec.ts apps/backend/src/infrastructure/mail/mail.module.ts apps/backend/src/infrastructure/mail/index.ts
git commit -m "feat(mailer): PlatformMailerService skeleton + module wiring"
```

---

## Task 4: All eight `send*` methods on `PlatformMailerService`

**Files:**
- Modify: `apps/backend/src/infrastructure/mail/platform-mailer.service.ts`
- Modify: `apps/backend/src/infrastructure/mail/platform-mailer.service.spec.ts`

- [ ] **Step 1: Extend the test**

Append the following to `platform-mailer.service.spec.ts`:

```ts
describe('PlatformMailerService — send', () => {
  beforeEach(() => {
    mockSend.mockReset();
    process.env.NODE_ENV = 'development';
  });

  function build(): PlatformMailerService {
    const svc = new PlatformMailerService(
      configWith({
        RESEND_API_KEY: 're_test',
        RESEND_FROM: 'CareKit <noreply@webvue.pro>',
        RESEND_REPLY_TO: 'support@webvue.pro',
      }),
    );
    svc.onModuleInit();
    return svc;
  }

  it('sendTenantWelcome calls Resend with from/replyTo/subject/html', async () => {
    mockSend.mockResolvedValue({ data: { id: 'msg_1' }, error: null });
    const svc = build();

    await svc.sendTenantWelcome('owner@example.com', {
      ownerName: 'Tariq',
      orgName: 'Sawa',
      dashboardUrl: 'https://app.example/dashboard',
    });

    expect(mockSend).toHaveBeenCalledTimes(1);
    const arg = mockSend.mock.calls[0][0];
    expect(arg.from).toBe('CareKit <noreply@webvue.pro>');
    expect(arg.replyTo).toBe('support@webvue.pro');
    expect(arg.to).toEqual(['owner@example.com']);
    expect(arg.subject).toContain('CareKit');
    expect(arg.html).toContain('Tariq');
    expect(arg.html).toContain('Sawa');
  });

  it('returns void and does NOT throw when Resend errors', async () => {
    mockSend.mockResolvedValue({ data: null, error: { message: '5xx upstream' } });
    const svc = build();
    await expect(
      svc.sendTenantWelcome('owner@example.com', {
        ownerName: 'X',
        orgName: 'Y',
        dashboardUrl: 'https://x',
      }),
    ).resolves.toBeUndefined();
  });

  it('returns void and warns when client is unavailable', async () => {
    delete process.env.NODE_ENV;
    const svc = new PlatformMailerService(configWith({}));
    svc.onModuleInit();
    await expect(
      svc.sendOtpLogin('user@example.com', { code: '123456', expiresInMinutes: 10 }),
    ).resolves.toBeUndefined();
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('sendOtpLogin uses the OTP subject + interpolates the code', async () => {
    mockSend.mockResolvedValue({ data: { id: 'msg_2' }, error: null });
    const svc = build();
    await svc.sendOtpLogin('user@example.com', { code: '482913', expiresInMinutes: 5 });
    const arg = mockSend.mock.calls[0][0];
    expect(arg.html).toContain('482913');
    expect(arg.subject.toLowerCase()).toMatch(/code|رمز/);
  });

  it('sendTrialEnding / sendTrialExpired / sendSubscriptionPaymentSucceeded / sendSubscriptionPaymentFailed / sendPlanChanged / sendAccountStatusChanged all dispatch via Resend', async () => {
    mockSend.mockResolvedValue({ data: { id: 'msg' }, error: null });
    const svc = build();

    await svc.sendTrialEnding('a@x', { ownerName: 'A', orgName: 'O', daysLeft: 3, upgradeUrl: 'https://u' });
    await svc.sendTrialExpired('a@x', { ownerName: 'A', orgName: 'O', upgradeUrl: 'https://u' });
    await svc.sendSubscriptionPaymentSucceeded('a@x', {
      ownerName: 'A', orgName: 'O', amountSar: '299.00', invoiceId: 'inv_1', receiptUrl: 'https://r',
    });
    await svc.sendSubscriptionPaymentFailed('a@x', {
      ownerName: 'A', orgName: 'O', amountSar: '299.00', reason: 'Card declined', billingUrl: 'https://b',
    });
    await svc.sendPlanChanged('a@x', {
      ownerName: 'A', orgName: 'O', fromPlanName: 'Basic', toPlanName: 'Pro', effectiveDate: '2026-05-01T00:00:00Z',
    });
    await svc.sendAccountStatusChanged('a@x', {
      ownerName: 'A', orgName: 'O', status: 'SUSPENDED', reason: 'overdue', contactUrl: 'https://c',
    });

    expect(mockSend).toHaveBeenCalledTimes(6);
  });
});
```

- [ ] **Step 2: Run tests → expect FAIL**

```bash
npx jest src/infrastructure/mail/platform-mailer.service.spec.ts
```

Expected: FAIL — methods don't exist yet.

- [ ] **Step 3: Implement the methods on `PlatformMailerService`**

Append to `platform-mailer.service.ts` (inside the class, after `isAvailable()`):

```ts
  // ── Public send API ────────────────────────────────────────────────────────

  async sendTenantWelcome(
    to: string,
    vars: import('./templates/tenant-welcome.template').TenantWelcomeVars,
  ): Promise<void> {
    const t = (await import('./templates/tenant-welcome.template')).tenantWelcomeTemplate(vars);
    await this.dispatch(to, this.preferAr(t.subjectAr, t.subjectEn), t.html);
  }

  async sendOtpLogin(
    to: string,
    vars: import('./templates/otp-login.template').OtpLoginVars,
  ): Promise<void> {
    const t = (await import('./templates/otp-login.template')).otpLoginTemplate(vars);
    await this.dispatch(to, this.preferAr(t.subjectAr, t.subjectEn), t.html);
  }

  async sendTrialEnding(
    to: string,
    vars: import('./templates/trial-ending.template').TrialEndingVars,
  ): Promise<void> {
    const t = (await import('./templates/trial-ending.template')).trialEndingTemplate(vars);
    await this.dispatch(to, this.preferAr(t.subjectAr, t.subjectEn), t.html);
  }

  async sendTrialExpired(
    to: string,
    vars: import('./templates/trial-expired.template').TrialExpiredVars,
  ): Promise<void> {
    const t = (await import('./templates/trial-expired.template')).trialExpiredTemplate(vars);
    await this.dispatch(to, this.preferAr(t.subjectAr, t.subjectEn), t.html);
  }

  async sendSubscriptionPaymentSucceeded(
    to: string,
    vars: import('./templates/subscription-payment-succeeded.template').SubscriptionPaymentSucceededVars,
  ): Promise<void> {
    const t = (
      await import('./templates/subscription-payment-succeeded.template')
    ).subscriptionPaymentSucceededTemplate(vars);
    await this.dispatch(to, this.preferAr(t.subjectAr, t.subjectEn), t.html);
  }

  async sendSubscriptionPaymentFailed(
    to: string,
    vars: import('./templates/subscription-payment-failed.template').SubscriptionPaymentFailedVars,
  ): Promise<void> {
    const t = (
      await import('./templates/subscription-payment-failed.template')
    ).subscriptionPaymentFailedTemplate(vars);
    await this.dispatch(to, this.preferAr(t.subjectAr, t.subjectEn), t.html);
  }

  async sendPlanChanged(
    to: string,
    vars: import('./templates/plan-changed.template').PlanChangedVars,
  ): Promise<void> {
    const t = (await import('./templates/plan-changed.template')).planChangedTemplate(vars);
    await this.dispatch(to, this.preferAr(t.subjectAr, t.subjectEn), t.html);
  }

  async sendAccountStatusChanged(
    to: string,
    vars: import('./templates/account-status-changed.template').AccountStatusChangedVars,
  ): Promise<void> {
    const t = (
      await import('./templates/account-status-changed.template')
    ).accountStatusChangedTemplate(vars);
    await this.dispatch(to, this.preferAr(t.subjectAr, t.subjectEn), t.html);
  }

  // ── Internals ──────────────────────────────────────────────────────────────

  /** Subject is the AR line followed by " · " followed by EN — Resend's UI shows
   *  the AR script first which matches our primary audience. */
  private preferAr(ar: string, en: string): string {
    return `${ar} · ${en}`;
  }

  private async dispatch(to: string, subject: string, html: string): Promise<void> {
    if (!this.client) {
      this.logger.warn(`PlatformMailer unavailable — skipping email to ${to}`);
      return;
    }
    try {
      const res = await this.client.emails.send({
        from: this.from,
        replyTo: this.replyTo,
        to: [to],
        subject,
        html,
      });
      if (res.error) {
        this.logger.error(`Resend send error for ${to}: ${res.error.message}`);
      }
    } catch (err) {
      this.logger.error(`Resend dispatch threw for ${to}`, err as Error);
    }
  }
```

- [ ] **Step 4: Run tests → expect PASS**

```bash
npx jest src/infrastructure/mail/platform-mailer.service.spec.ts
```

Expected: PASS, all tests.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/infrastructure/mail/platform-mailer.service.ts apps/backend/src/infrastructure/mail/platform-mailer.service.spec.ts
git commit -m "feat(mailer): eight send methods on PlatformMailerService"
```

---

## Task 5: Prisma migration — `Subscription.notifiedTrialEndingAt`

**Files:**
- Modify: `apps/backend/prisma/schema/platform.prisma`
- Create: `apps/backend/prisma/migrations/<TIMESTAMP>_add_subscription_notified_trial_ending/migration.sql`

- [ ] **Step 1: Add the field to the Prisma model**

Open `apps/backend/prisma/schema/platform.prisma`. Find the `Subscription` model. Add this line just below `lastFailureReason`:

```prisma
  notifiedTrialEndingAt DateTime? // Resend platform emails: dedupe trial-ending notifications
```

- [ ] **Step 2: Generate migration**

```bash
cd apps/backend
npx prisma migrate dev --name add_subscription_notified_trial_ending --create-only
```

This creates `prisma/migrations/<timestamp>_add_subscription_notified_trial_ending/migration.sql`. Inspect — it should be a single `ALTER TABLE "Subscription" ADD COLUMN "notifiedTrialEndingAt" TIMESTAMP(3);` statement. Nothing else.

- [ ] **Step 3: Apply + regenerate client**

```bash
npx prisma migrate deploy
npx prisma generate
```

- [ ] **Step 4: Confirm typecheck still green**

```bash
npm run typecheck
```

Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/prisma/schema/platform.prisma apps/backend/prisma/migrations/
git commit -m "feat(billing): track Subscription.notifiedTrialEndingAt for resend dedupe"
```

---

## Task 6: Wire `sendTenantWelcome` into `RegisterTenantHandler`

**Files:**
- Modify: `apps/backend/src/modules/platform/tenant-registration/register-tenant.handler.ts`
- Modify: `apps/backend/src/modules/platform/tenant-registration/register-tenant.handler.spec.ts`

- [ ] **Step 1: Extend the spec — add the mailer factory + a failing test**

Open `register-tenant.handler.spec.ts`. Just after `const makeStartSub = () => ({ execute: jest.fn().mockResolvedValue({ id: 'sub-1' }) });` (around line 36), add:

```ts
const makeMailer = () => ({ sendTenantWelcome: jest.fn().mockResolvedValue(undefined) });
```

Add a `mailer` field to the `describe` block's `let`s, initialize it in `beforeEach`, and pass it as the **last** constructor argument:

```ts
  let mailer: ReturnType<typeof makeMailer>;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = makePrisma();
    tokens = makeTokens();
    startSub = makeStartSub();
    tenant = makeTenant();
    mailer = makeMailer();
    handler = new RegisterTenantHandler(
      prisma as never,
      makePassword() as never,
      tokens as never,
      makeConfig() as never,
      tenant as never,
      makeCache() as never,
      startSub as never,
      mailer as never,
    );
  });
```

Then add this new test inside the `describe('RegisterTenantHandler', …)` block:

```ts
  it('sends a welcome email to the tenant owner on success', async () => {
    await handler.execute({
      name: 'Tariq',
      email: 'owner@example.com',
      phone: '0500000000',
      password: 'StrongPwd1!',
      businessNameAr: 'سوا',
    });

    expect(mailer.sendTenantWelcome).toHaveBeenCalledWith(
      'owner@example.com',
      expect.objectContaining({
        ownerName: 'Tariq',
        orgName: 'سوا',
        dashboardUrl: expect.stringMatching(/^https?:\/\//),
      }),
    );
  });
```

- [ ] **Step 2: Run test → expect FAIL**

```bash
npx jest src/modules/platform/tenant-registration/register-tenant.handler.spec.ts
```

Expected: the new test fails because the handler doesn't call `mailer`.

- [ ] **Step 3: Add `PlatformMailerService` to handler constructor and call after success**

Edit `register-tenant.handler.ts`:

1. Add to the imports block:

```ts
import { PlatformMailerService } from '../../../infrastructure/mail';
```

2. Add to the constructor params (last position to avoid renumbering existing ones in tests):

```ts
    private readonly mailer: PlatformMailerService,
```

3. Just before `return { ...tokenPair, userId: result.userId };` at the end of `execute()`, insert:

```ts
    const dashboardUrl = this.config.get<string>(
      'PLATFORM_DASHBOARD_URL',
      'https://app.webvue.pro/dashboard',
    );
    await this.mailer.sendTenantWelcome(dto.email, {
      ownerName: dto.name,
      orgName: dto.businessNameAr,
      dashboardUrl,
    });
```

- [ ] **Step 4: Run test → expect PASS**

```bash
npx jest src/modules/platform/tenant-registration/register-tenant.handler.spec.ts
```

Expected: PASS, all tests including the new one.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/modules/platform/tenant-registration/
git commit -m "feat(billing): send welcome email after tenant registration"
```

---

## Task 7: Wire trial-ending + trial-expired into `ExpireTrialsCron`

**Files:**
- Modify: `apps/backend/src/modules/platform/billing/expire-trials/expire-trials.cron.ts`
- Modify: `apps/backend/src/modules/platform/billing/expire-trials/expire-trials.cron.spec.ts`

> The cron currently only handles the trial-expired transition. We're adding two separate concerns:
> 1. Send a reminder when `trialEndsAt` is within ≤3 days AND `notifiedTrialEndingAt IS NULL` (set the column afterward).
> 2. Send the expired email when the existing `TRIALING → PAST_DUE` transition fires for an org.

- [ ] **Step 1: Extend the spec with two failing tests**

Add to `expire-trials.cron.spec.ts`:

```ts
import { PlatformMailerService } from '../../../../infrastructure/mail';

it('sends trial-ending email for orgs in 3-day window not already notified', async () => {
  const mailer = {
    sendTrialEnding: jest.fn().mockResolvedValue(undefined),
    sendTrialExpired: jest.fn().mockResolvedValue(undefined),
  } as unknown as PlatformMailerService;

  // mirror existing test setup; ensure `prisma.subscription.findMany` returns
  // one trialing sub with `trialEndsAt` 2 days from now, `notifiedTrialEndingAt` null,
  // and an OWNER membership with email "owner@example.com".

  // …construct cron with mailer…

  await cron.execute();

  expect(mailer.sendTrialEnding).toHaveBeenCalledWith(
    'owner@example.com',
    expect.objectContaining({ daysLeft: expect.any(Number) }),
  );
  expect(mailer.sendTrialExpired).not.toHaveBeenCalled();
});

it('sends trial-expired email when org transitions TRIALING → PAST_DUE', async () => {
  const mailer = {
    sendTrialEnding: jest.fn().mockResolvedValue(undefined),
    sendTrialExpired: jest.fn().mockResolvedValue(undefined),
  } as unknown as PlatformMailerService;

  // mirror existing setup — one expired trial.

  await cron.execute();

  expect(mailer.sendTrialExpired).toHaveBeenCalledWith(
    'owner@example.com',
    expect.objectContaining({ orgName: expect.any(String) }),
  );
});
```

- [ ] **Step 2: Run tests → expect FAIL**

```bash
npx jest src/modules/platform/billing/expire-trials/
```

Expected: new assertions fail.

- [ ] **Step 3: Update `ExpireTrialsCron`**

Replace the existing `expire-trials.cron.ts` with:

```ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import { SubscriptionCacheService } from '../subscription-cache.service';
import { PlatformMailerService } from '../../../../infrastructure/mail';

const TRIAL_ENDING_WINDOW_DAYS = 3;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

@Injectable()
export class ExpireTrialsCron {
  private readonly logger = new Logger(ExpireTrialsCron.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly cache: SubscriptionCacheService,
    private readonly mailer: PlatformMailerService,
  ) {}

  async execute(): Promise<void> {
    if (!this.config.get<boolean>('BILLING_CRON_ENABLED', false)) return;

    const now = new Date();
    const upgradeUrl = this.config.get<string>(
      'PLATFORM_DASHBOARD_URL',
      'https://app.webvue.pro/dashboard',
    ) + '/billing';

    await this.notifyTrialEnding(now, upgradeUrl);
    await this.notifyTrialExpired(now, upgradeUrl);
  }

  /** Send a reminder when trialEndsAt is within the next N days and we haven't
   *  already notified. Mark `notifiedTrialEndingAt` to dedupe future ticks. */
  private async notifyTrialEnding(now: Date, upgradeUrl: string): Promise<void> {
    const windowEnd = new Date(now.getTime() + TRIAL_ENDING_WINDOW_DAYS * MS_PER_DAY);
    const subs = await this.prisma.$allTenants.subscription.findMany({
      where: {
        status: 'TRIALING',
        notifiedTrialEndingAt: null,
        // trialEndsAt is denormalized on Organization, not Subscription;
        // join via the relation.
      },
      include: { organization: true },
    });

    for (const sub of subs) {
      const trialEndsAt = sub.organization.trialEndsAt;
      if (!trialEndsAt) continue;
      if (trialEndsAt <= now) continue; // already expired — handled below
      if (trialEndsAt > windowEnd) continue; // outside window

      const owner = await this.lookupOwner(sub.organizationId);
      if (!owner) continue;

      const daysLeft = Math.max(
        1,
        Math.ceil((trialEndsAt.getTime() - now.getTime()) / MS_PER_DAY),
      );

      await this.mailer.sendTrialEnding(owner.email, {
        ownerName: owner.name,
        orgName: sub.organization.nameAr,
        daysLeft,
        upgradeUrl,
      });

      await this.prisma.$allTenants.subscription.update({
        where: { id: sub.id },
        data: { notifiedTrialEndingAt: now },
      });
    }
  }

  private async notifyTrialExpired(now: Date, upgradeUrl: string): Promise<void> {
    const expiredOrgs = await this.prisma.organization.findMany({
      where: {
        status: 'TRIALING',
        trialEndsAt: { lt: now },
      },
      select: { id: true, nameAr: true },
    });

    if (expiredOrgs.length === 0) return;

    const orgIds = expiredOrgs.map((o) => o.id);

    await this.prisma.organization.updateMany({
      where: { id: { in: orgIds } },
      data: { status: 'PAST_DUE' },
    });

    await this.prisma.subscription.updateMany({
      where: { organizationId: { in: orgIds }, status: 'TRIALING' },
      data: { status: 'PAST_DUE', pastDueSince: now },
    });

    for (const org of expiredOrgs) {
      this.cache.invalidate(org.id);
      const owner = await this.lookupOwner(org.id);
      if (owner) {
        await this.mailer.sendTrialExpired(owner.email, {
          ownerName: owner.name,
          orgName: org.nameAr,
          upgradeUrl,
        });
      }
    }

    this.logger.log(`Transitioned ${orgIds.length} expired trials to PAST_DUE`);
  }

  private async lookupOwner(
    organizationId: string,
  ): Promise<{ email: string; name: string } | null> {
    const membership = await this.prisma.$allTenants.membership.findFirst({
      where: { organizationId, role: 'OWNER', isActive: true },
      include: { user: { select: { email: true, name: true } } },
    });
    return membership?.user
      ? { email: membership.user.email, name: membership.user.name ?? '' }
      : null;
  }
}
```

> **Note on `$allTenants`:** the cron runs without a CLS tenant context, so all reads/writes go through `$allTenants` to bypass scoping. This mirrors how the existing logic for `notifyTrialExpired` reads `Organization` directly via `prisma.organization.findMany` (Organization is not in `SCOPED_MODELS`). For `Membership` and `Subscription` (both scoped), `$allTenants` is required.

- [ ] **Step 4: Update the existing cron tests**

The existing test setup builds the cron with three deps. Add the fourth (`mailer`). Re-run:

```bash
npx jest src/modules/platform/billing/expire-trials/
```

Expected: all tests pass, including the two new ones.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/modules/platform/billing/expire-trials/
git commit -m "feat(billing): send trial-ending + trial-expired emails from cron"
```

---

## Task 8: Wire payment-succeeded + payment-failed emails

**Files:**
- Modify: `apps/backend/src/modules/platform/billing/record-subscription-payment/record-subscription-payment.handler.ts`
- Modify: `apps/backend/src/modules/platform/billing/record-subscription-payment/record-subscription-payment.handler.spec.ts`
- Modify: `apps/backend/src/modules/platform/billing/record-subscription-payment-failure/record-subscription-payment-failure.handler.ts`
- Modify: `apps/backend/src/modules/platform/billing/record-subscription-payment-failure/record-subscription-payment-failure.handler.spec.ts`

- [ ] **Step 1: Extend payment-succeeded spec**

Add a test that asserts `mailer.sendSubscriptionPaymentSucceeded` is called after successful payment, with `amountSar` derived from `invoice.amountTotal` (string, two decimals), `invoiceId`, and a receipt URL.

```ts
it('sends a payment-succeeded email to the org owner', async () => {
  // existing setup creates the invoice + subscription
  await handler.execute({ invoiceId, moyasarPaymentId: 'pay_1' });
  expect(mailer.sendSubscriptionPaymentSucceeded).toHaveBeenCalledWith(
    'owner@example.com',
    expect.objectContaining({
      amountSar: expect.stringMatching(/^\d+\.\d{2}$/),
      invoiceId,
      receiptUrl: expect.stringContaining(invoiceId),
    }),
  );
});
```

- [ ] **Step 2: Update the handler**

Add `mailer: PlatformMailerService` and `config: ConfigService` to the constructor. After the transaction completes, look up the OWNER membership via `$allTenants.membership.findFirst({ ... })`. Build the dashboard URL from `PLATFORM_DASHBOARD_URL` + `/billing/<invoiceId>`. Format the amount as `Number(invoice.amountTotal).toFixed(2)` (Prisma `Decimal` is converted to a string with two decimals — the model uses `Decimal(10,2)`).

```ts
import { ConfigService } from '@nestjs/config';
import { PlatformMailerService } from '../../../../infrastructure/mail';

// …in constructor:
    private readonly mailer: PlatformMailerService,
    private readonly config: ConfigService,

// …after the transaction, before `return { ok: true }`:
    const owner = await this.prisma.$allTenants.membership.findFirst({
      where: { organizationId: sub.organizationId, role: 'OWNER', isActive: true },
      include: { user: { select: { email: true, name: true } }, organization: { select: { nameAr: true } } },
    });
    if (owner?.user) {
      const baseUrl = this.config.get<string>(
        'PLATFORM_DASHBOARD_URL',
        'https://app.webvue.pro/dashboard',
      );
      await this.mailer.sendSubscriptionPaymentSucceeded(owner.user.email, {
        ownerName: owner.user.name ?? '',
        orgName: owner.organization.nameAr,
        amountSar: Number(invoice.amountTotal).toFixed(2),
        invoiceId: invoice.id,
        receiptUrl: `${baseUrl}/billing/${invoice.id}`,
      });
    }
```

- [ ] **Step 3: Run + green**

```bash
npx jest src/modules/platform/billing/record-subscription-payment/
```

- [ ] **Step 4: Repeat for payment-failure**

Same shape, but call `mailer.sendSubscriptionPaymentFailed`, pass `reason: cmd.reason`, and use `${baseUrl}/billing` as `billingUrl`. Add the equivalent test.

```ts
// inside record-subscription-payment-failure.handler.ts after the transaction:
    const owner = await this.prisma.$allTenants.membership.findFirst({
      where: { organizationId: sub.organizationId, role: 'OWNER', isActive: true },
      include: { user: { select: { email: true, name: true } }, organization: { select: { nameAr: true } } },
    });
    if (owner?.user) {
      const baseUrl = this.config.get<string>(
        'PLATFORM_DASHBOARD_URL',
        'https://app.webvue.pro/dashboard',
      );
      await this.mailer.sendSubscriptionPaymentFailed(owner.user.email, {
        ownerName: owner.user.name ?? '',
        orgName: owner.organization.nameAr,
        amountSar: Number(invoice.amountTotal).toFixed(2),
        reason: cmd.reason,
        billingUrl: `${baseUrl}/billing`,
      });
    }
```

- [ ] **Step 5: Run both files green**

```bash
npx jest src/modules/platform/billing/record-subscription-payment src/modules/platform/billing/record-subscription-payment-failure
```

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/modules/platform/billing/record-subscription-payment/ apps/backend/src/modules/platform/billing/record-subscription-payment-failure/
git commit -m "feat(billing): notify tenant owner on subscription payment success/failure"
```

---

## Task 9: Wire plan-changed (upgrade + downgrade)

**Files:**
- Modify: `apps/backend/src/modules/platform/billing/upgrade-plan/upgrade-plan.handler.ts`
- Modify: `apps/backend/src/modules/platform/billing/upgrade-plan/upgrade-plan.handler.spec.ts`
- Modify: `apps/backend/src/modules/platform/billing/downgrade-plan/downgrade-plan.handler.ts`
- Modify: `apps/backend/src/modules/platform/billing/downgrade-plan/downgrade-plan.handler.spec.ts`

- [ ] **Step 1: Extend upgrade spec**

```ts
it('sends a plan-changed email after a successful upgrade', async () => {
  // existing setup: org, OWNER membership, current plan Basic, target plan Pro
  await handler.execute({ planId: targetPlanId, billingCycle: 'MONTHLY' });
  expect(mailer.sendPlanChanged).toHaveBeenCalledWith(
    'owner@example.com',
    expect.objectContaining({
      fromPlanName: 'Basic',
      toPlanName: 'Pro',
      effectiveDate: expect.any(String),
    }),
  );
});
```

- [ ] **Step 2: Update upgrade handler**

After `cache.invalidate(...)`, before `return updated`:

```ts
    const owner = await this.prisma.$allTenants.membership.findFirst({
      where: { organizationId, role: 'OWNER', isActive: true },
      include: { user: { select: { email: true, name: true } }, organization: { select: { nameAr: true } } },
    });
    if (owner?.user) {
      await this.mailer.sendPlanChanged(owner.user.email, {
        ownerName: owner.user.name ?? '',
        orgName: owner.organization.nameAr,
        fromPlanName: sub.plan.name,
        toPlanName: targetPlan.name,
        effectiveDate: new Date().toISOString(),
      });
    }
```

Also add `private readonly mailer: PlatformMailerService` to the constructor and import.

- [ ] **Step 3: Repeat identically for downgrade handler**

Same logic, same template — only the trigger context differs (and validation in the handler). Wire mailer the same way.

- [ ] **Step 4: Run both green**

```bash
npx jest src/modules/platform/billing/upgrade-plan src/modules/platform/billing/downgrade-plan
```

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/modules/platform/billing/upgrade-plan/ apps/backend/src/modules/platform/billing/downgrade-plan/
git commit -m "feat(billing): notify owner on plan upgrade/downgrade"
```

---

## Task 10: Wire account-status-changed (suspend + reinstate)

**Files:**
- Modify: `apps/backend/src/modules/platform/admin/suspend-organization/suspend-organization.handler.ts`
- Modify: `apps/backend/src/modules/platform/admin/suspend-organization/suspend-organization.handler.spec.ts`
- Modify: `apps/backend/src/modules/platform/admin/reinstate-organization/reinstate-organization.handler.ts`
- Modify: `apps/backend/src/modules/platform/admin/reinstate-organization/reinstate-organization.handler.spec.ts`

- [ ] **Step 1: Extend suspend spec**

```ts
it('sends an account-suspended email to the org owner', async () => {
  await handler.execute({
    organizationId: 'org_1',
    superAdminUserId: 'sa_1',
    reason: 'Outstanding invoice',
    ipAddress: '1.1.1.1',
    userAgent: 'jest',
  });
  expect(mailer.sendAccountStatusChanged).toHaveBeenCalledWith(
    'owner@example.com',
    expect.objectContaining({ status: 'SUSPENDED', reason: 'Outstanding invoice' }),
  );
});
```

- [ ] **Step 2: Update suspend handler**

After the transaction + redis cache invalidation, before the method returns:

```ts
    const owner = await this.prisma.$allTenants.membership.findFirst({
      where: { organizationId: cmd.organizationId, role: 'OWNER', isActive: true },
      include: { user: { select: { email: true, name: true } }, organization: { select: { nameAr: true } } },
    });
    if (owner?.user) {
      await this.mailer.sendAccountStatusChanged(owner.user.email, {
        ownerName: owner.user.name ?? '',
        orgName: owner.organization.nameAr,
        status: 'SUSPENDED',
        reason: cmd.reason,
        contactUrl: 'mailto:support@webvue.pro',
      });
    }
```

Inject `mailer: PlatformMailerService` in constructor.

- [ ] **Step 3: Repeat for reinstate handler**

Same shape, but `status: 'REINSTATED'`, `reason: cmd.reason`, and `contactUrl: this.config.get<string>('PLATFORM_DASHBOARD_URL', 'https://app.webvue.pro/dashboard')`. Inject `config: ConfigService` if not already present.

- [ ] **Step 4: Run both green**

```bash
npx jest src/modules/platform/admin/suspend-organization src/modules/platform/admin/reinstate-organization
```

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/modules/platform/admin/suspend-organization/ apps/backend/src/modules/platform/admin/reinstate-organization/
git commit -m "feat(admin): notify owner on account suspend/reinstate"
```

---

## Task 11: `.env.example` + CLAUDE.md

**Files:**
- Modify: `apps/backend/.env.example`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Append to `apps/backend/.env.example`**

```env

# ── Platform email (Resend) ─────────────────────────────────────────────────
# Required in production. Optional in dev/test (mailer no-ops + warns).
RESEND_API_KEY=
# Optional, sensible defaults in code:
RESEND_FROM=CareKit <noreply@webvue.pro>
RESEND_REPLY_TO=support@webvue.pro
PLATFORM_DASHBOARD_URL=https://app.webvue.pro/dashboard
```

- [ ] **Step 2: Update root `CLAUDE.md`**

Find the **Comms cluster** row in the backend module map (line ~134) and add this paragraph just under the table (before the "See `apps/backend/CLAUDE.md` for cluster-by-cluster detail" line):

```markdown
> **Email split:** clinic↔client emails go through `SmtpService` (per-tenant
> credentials planned). Platform↔tenant-owner emails (welcome, trial
> ending/expired, payment success/failure, plan changes, account
> suspend/reinstate, super-admin OTP login) go through
> `PlatformMailerService` (Resend, single platform account, domain
> `webvue.pro`). The two services do not share state.
```

- [ ] **Step 3: Commit**

```bash
git add apps/backend/.env.example CLAUDE.md
git commit -m "docs(mailer): document Resend platform emails + env vars"
```

---

## Task 12: Full backend regression sweep

- [ ] **Step 1: Typecheck**

```bash
cd apps/backend && npm run typecheck
```

Expected: clean.

- [ ] **Step 2: Full unit + e2e**

```bash
npx jest --silent
```

Expected: 295/295 suites green (no regressions vs. main).

- [ ] **Step 3: Lint**

```bash
npm run lint
```

Expected: 0 errors.

- [ ] **Step 4: Open PR**

```bash
git push -u origin feat/resend-platform-emails
gh pr create --title "feat(mailer): Resend platform emails (welcome / trial / billing / account-status)" --body "$(cat <<'EOF'
## Summary

Adds a new `PlatformMailerService` (Resend SDK) for CareKit ↔ tenant-owner
emails, separate from the existing `SmtpService` (which keeps serving
clinic ↔ client emails).

Eight method-per-email surface; bilingual AR+EN HTML templates; one additive
migration for `Subscription.notifiedTrialEndingAt` to dedupe trial-ending
notifications. Seven existing handlers get one new line each.

## Spec

- `docs/superpowers/specs/2026-04-29-resend-platform-emails-design.md`

## Verification

- typecheck clean
- 295 suites / N tests pass (delta: +<test count> from this branch)
- lint clean

## Out of scope

- super-admin OTP login flow (separate PR — `sendOtpLogin` exists, no caller)
- per-recipient locale / `User.preferredLocale` column
- `PlatformEmailLog` audit table
- per-tenant Resend

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Acceptance criteria recap

- [ ] `PlatformMailerService` with eight methods, registered in `MailModule`.
- [ ] Eight bilingual templates with snapshot tests.
- [ ] Migration applied: `Subscription.notifiedTrialEndingAt`.
- [ ] Seven trigger sites wired (welcome / trial-ending / trial-expired / payment-succeeded / payment-failed / plan-changed × 2 / account-status × 2).
- [ ] `.env.example` + `CLAUDE.md` updated.
- [ ] `npm run typecheck`, `npx jest`, `npm run lint` all green.
