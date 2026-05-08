---
"backend": patch
---

Fix three production-blocking bugs that surfaced after v2.1.4 deploy under `TENANT_ENFORCEMENT=strict`:

1. **Login response membership lookup** — `auth.controller.ts:loginEndpoint()` did a second `prisma.membership.findFirst()` (after `LoginHandler.execute()`) without tenant context. Wrapped in `cls.run` + `SUPER_ADMIN_CONTEXT_CLS_KEY` + `$allTenants`, mirroring the pattern from `LoginHandler.execute()` and `refreshEndpoint()`.

2. **Password reset captcha** — admin's forgot-password form doesn't render a captcha widget, so requests arrived without `hCaptchaToken` and `request-password-reset` rejected them with `CAPTCHA_FAILED`. Dropped the `captcha.verify()` call (consistent with the platform-wide captcha pause until Cloudflare Turnstile lands).

3. **`SubscriptionCacheService.get()`** — read `Subscription` (a SCOPED model) directly without `$allTenants`. Called from cross-tenant code paths (cron jobs, `SendEmailHandler` during password-reset email), where no CLS tenant context exists. Now wraps in `cls.run` + `SUPER_ADMIN_CONTEXT_CLS_KEY` + `$allTenants`. The existing `organizationId` filter still scopes correctly.
