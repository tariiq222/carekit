# Resend Platform Emails

**Status:** drafted, awaiting user review then implementation plan.
**Owner:** @tariq.
**Severity:** P1 — billing lifecycle currently has no outbound communication; tenants don't know when trials end, payments succeed, or accounts get suspended.

## Why this exists

Today the only platform-level email is `ResetUserPasswordHandler` (super-admin issuing a temp password to a tenant user). Everything else in the billing lifecycle — trial ending, trial expired, payment succeeded, payment failed, plan changed, account suspended/reinstated, tenant welcome — happens silently. Tenants have no way to know what's going on with their account except logging in.

We also need a transport for super-admin OTP login (planned in a follow-up PR), so we want the platform mailer wired up first.

## What this is NOT

- **Not** a replacement for the existing `SmtpService`. SMTP stays exactly where it is, serving the `comms` cluster (clinic ↔ client emails). Mobile + dashboard email flows do not change.
- **Not** per-tenant email credentials. Every email sent through this path is from CareKit (the platform) to a tenant owner. One Resend account, one domain, one sender for the whole platform.
- **Not** an `EmailTemplate` DB table. Platform emails are static, code-owned content; only `comms` cluster templates remain DB-driven.
- **Not** the super-admin OTP login flow itself. This PR builds the mailer + the `sendOtpLogin()` method; the actual login flow is a separate spec.

## Architecture

A new `PlatformMailerService` lives at `apps/backend/src/infrastructure/mail/platform-mailer.service.ts`, alongside the existing `SmtpService`. They share the `mail.module.ts` for DI but are independent — neither calls the other.

```
apps/backend/src/infrastructure/mail/
├── smtp.service.ts                   ← unchanged (comms cluster, per-tenant later)
├── smtp.service.spec.ts
├── fcm.service.ts                    ← unchanged (push)
├── fcm.service.spec.ts
├── mail.module.ts                    ← exports PlatformMailerService too
├── platform-mailer.service.ts        ← NEW
├── platform-mailer.service.spec.ts   ← NEW
├── platform-mailer.errors.ts         ← NEW (typed errors)
└── templates/
    ├── shared.ts                     ← bilingual layout helper, brand tokens
    ├── tenant-welcome.template.ts
    ├── otp-login.template.ts
    ├── trial-ending.template.ts
    ├── trial-expired.template.ts
    ├── subscription-payment-succeeded.template.ts
    ├── subscription-payment-failed.template.ts
    ├── plan-changed.template.ts
    └── account-status-changed.template.ts
```

### Service shape

```ts
@Injectable()
export class PlatformMailerService {
  // Idempotent at the bootstrap level: the resend client is constructed
  // once if RESEND_API_KEY is present, otherwise null + warn (dev parity
  // with SmtpService.isAvailable()).
  isAvailable(): boolean;

  sendTenantWelcome(to: string, vars: TenantWelcomeVars): Promise<void>;
  sendOtpLogin(to: string, vars: OtpLoginVars): Promise<void>;
  sendTrialEnding(to: string, vars: TrialEndingVars): Promise<void>;
  sendTrialExpired(to: string, vars: TrialExpiredVars): Promise<void>;
  sendSubscriptionPaymentSucceeded(to: string, vars: PaymentSucceededVars): Promise<void>;
  sendSubscriptionPaymentFailed(to: string, vars: PaymentFailedVars): Promise<void>;
  sendPlanChanged(to: string, vars: PlanChangedVars): Promise<void>;
  sendAccountStatusChanged(to: string, vars: AccountStatusVars): Promise<void>;
}
```

Why method-per-email (not a generic `send(template, vars)`):

- Compile-time type safety on per-template `vars`. Forgetting a variable becomes a TS error, not a runtime missing-string.
- Each method owns its `subject` / `from` / `replyTo` / preheader internally — no runtime registry lookup.
- Dev grep-ability: a billing handler that calls `mailer.sendTrialEnding(...)` is greppable end-to-end without going through a config table.

### Templates

HTML strings, bilingual (Arabic on top, English below — same shape as `email-channel.adapter.ts:23-38`). Each template file exports a single function:

```ts
// trial-ending.template.ts
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
  return { /* … */ };
}
```

`shared.ts` provides:

- `bilingualLayout({ ar, en })` — wraps two halves in a single brand-styled HTML doc with `<!DOCTYPE html>`, head, `dir="rtl"` on the AR half, `dir="ltr"` on the EN half.
- `escapeHtml(value)` — single source of truth for value escaping (currently duplicated inline in `reset-user-password.handler.ts:79-86`).
- `BRAND` — `{ primary: '#354FD8', accent: '#82CC17', fontFamily: "'IBM Plex Sans Arabic', Arial, sans-serif" }`.

No React Email, no MJML, no JSX renderer dependency — eight static templates do not justify a build pipeline.

### i18n strategy

**Single bilingual email, AR + EN stacked.** No per-recipient locale lookup in this PR. The User model does not carry a `preferredLocale` column on `User` (verified in `prisma/schema/identity.prisma`). Adding one is a separate change — flagged as a follow-up below.

### Dev / test fallback

Mirrors `SmtpService.isAvailable()`:

- Production (`NODE_ENV=production`): if `RESEND_API_KEY` is missing, the service throws on bootstrap. We do not silently swallow.
- Dev / test: if missing, the service logs a warning at boot and `isAvailable()` returns false. Each `send*` method becomes a no-op + warn (so cron jobs and webhooks don't crash local stacks).
- Unit/e2e: tests `overrideProvider(PlatformMailerService).useValue({ ... })` with a fake. The Resend SDK is never imported in test code paths.

## Trigger sites — where each email gets sent from

All seven new send sites live inside the `platform/billing/` and `platform/admin/` clusters. None require a new module — just an injected `PlatformMailerService` in the existing handler.

| Email | Trigger handler | New code? |
|---|---|---|
| Tenant welcome | `RegisterTenantHandler` at `apps/backend/src/modules/platform/tenant-registration/register-tenant.handler.ts` — tail of success path | Add 1 line: `await mailer.sendTenantWelcome(...)` |
| OTP login | (placeholder for follow-up super-admin OTP PR) | Method exists, no caller in this PR |
| Trial ending soon | `ExpireTrialsCron.run()` (existing) — for each subscription where `now + 3d ≥ trialEndsAt > now` and we haven't already notified | New: track "notified" via a `notifiedTrialEndingAt: DateTime?` column on `Subscription` (small migration) |
| Trial expired | `ExpireTrialsCron.run()` — fires on transition `TRIAL → EXPIRED` | Add 1 line in the existing transition |
| Payment succeeded | `RecordSubscriptionPaymentHandler` — after `Subscription` PAID transition | Add 1 line |
| Payment failed | `RecordSubscriptionPaymentFailureHandler` — after invoice `FAILED` write | Add 1 line |
| Plan changed | `UpgradePlanHandler` + `DowngradePlanHandler` | Add 1 line each (or factor a shared helper if both share the email) |
| Account suspended / reinstated | `SuspendOrganizationHandler` + `ReinstateOrganizationHandler` (super-admin) | Add 1 line each |

The "owner email" in every case is resolved as: `Membership.findFirst({ where: { organizationId, role: 'OWNER', isActive: true } })`, then `User.email`. If no OWNER membership exists (a deactivated org), we skip + log + do not throw.

## Configuration

```env
# Required in production, optional in dev/test
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxx
# All optional with sensible defaults below
RESEND_FROM=CareKit <noreply@webvue.pro>
RESEND_REPLY_TO=support@webvue.pro
```

Defaults baked in code (so `.env.example` and Docker compose overlays don't drift):

- `from`: `CareKit <noreply@webvue.pro>`
- `replyTo`: `support@webvue.pro`

Domain `webvue.pro` is the platform's outbound email domain. DKIM/SPF setup happens once in Resend dashboard (operations task, tracked separately, not part of this PR).

## Schema impact

**One migration**, additive only:

```prisma
model Subscription {
  // … existing fields
  notifiedTrialEndingAt DateTime?  // SaaS-resend: avoid spamming trial-ending email more than once
}
```

That's it. No new tables. Email logging / audit can be added later if we need `who got which email when` — until then, Resend's own dashboard + Sentry breadcrumbs are sufficient.

## Error handling

Every `send*` method:

1. Resolves to/from/replyTo/subject/html.
2. Calls `resend.emails.send({...})`.
3. On success: returns void.
4. On Resend API error: logs at `error` level with a Sentry breadcrumb tagged `mailer:platform`, swallows the error, returns void. **We never let an email failure break the calling handler** (a webhook handler must finish writing PAID before, not be blocked by Resend latency or 5xx).

The single exception is bootstrap: in production, missing `RESEND_API_KEY` throws so we don't silently lose all platform email for weeks.

## Testing

### Unit (`platform-mailer.service.spec.ts`)

- Constructs with no `RESEND_API_KEY` in dev → `isAvailable() === false`, send methods are no-ops.
- Constructs without `RESEND_API_KEY` in prod → throws on `OnModuleInit`.
- Each `send*` method calls `resend.emails.send` with the right `from`, `replyTo`, `subject`, and an HTML body containing the expected interpolated vars.
- Resend client throws → handler logs + returns void (does not propagate).

### Template snapshot tests (`templates/__tests__/*.spec.ts`)

For each of the eight templates: snapshot the rendered HTML for a fixed vars payload. Catches accidental brand-color drift, escaping bugs, missing AR/EN parity.

### Integration

No e2e for this PR. Adding a "real Resend send to a sandbox inbox" e2e is overkill for the value; the trigger-site changes get unit coverage in their respective handlers (e.g., `RecordSubscriptionPaymentHandler.spec.ts` asserts `mailer.sendSubscriptionPaymentSucceeded` was called with the right vars).

## Out of scope (explicit follow-ups)

1. **Super-admin OTP login flow** — separate spec. This PR only ships the `sendOtpLogin()` method; no caller wires it.
2. **Per-recipient locale.** When `User.preferredLocale` lands, switch templates from bilingual-stacked to locale-specific.
3. **`PlatformEmailLog` table.** If/when we need internal "who got what when" audit, add it as a new migration with `(orgId, userId, kind, sentAt, providerMessageId)`.
4. **Per-tenant Resend.** If a tenant ever wants their billing emails sent from their own domain, that's a separate `OrganizationPlatformMailerConfig` singleton — same shape as `OrganizationSmsConfig`.
5. **DKIM/SPF/DMARC config in Resend dashboard.** Operations task, tracked outside the codebase.

## Acceptance criteria

- [ ] `PlatformMailerService` exists at the path above, injected in `MailModule`, exported.
- [ ] Eight template files exist with bilingual AR+EN content, brand-tokenized, escaping all vars.
- [ ] `Subscription.notifiedTrialEndingAt` migration applied.
- [ ] Seven trigger-site changes wired (welcome / trial-ending / trial-expired / payment-succeeded / payment-failed / plan-changed / account-status-changed). The eighth (`sendOtpLogin`) has no caller — that's intentional.
- [ ] Unit tests cover the service, all eight templates, and at least one trigger-site spec per email kind.
- [ ] `npx jest` green on backend (no e2e regression).
- [ ] `.env.example` updated with the three new vars.
- [ ] CLAUDE.md (root or backend) gets a one-paragraph entry under Comms cluster: "Platform emails (CareKit ↔ tenant owner) go through `PlatformMailerService` (Resend); tenant↔client emails stay on `SmtpService`."
