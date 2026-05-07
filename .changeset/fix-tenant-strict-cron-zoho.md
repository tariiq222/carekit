---
"backend": patch
---

Unblock production login + ops crons under `TENANT_ENFORCEMENT=strict` (#151). `LoginHandler.membership.findMany` and 6 ops cron tasks (booking-expiry legacy, booking-noshow, booking-autocomplete, group-session-automation, appointment-reminders, refresh-token-cleanup) now wrap their scoped queries in `cls.run` + `SUPER_ADMIN_CONTEXT_CLS_KEY` and switch to `prisma.$allTenants` — the canonical bypass for entry-points without a resolved tenant context. Also lazy-init `ZohoCredentialsService` so a missing `ZOHO_PROVIDER_ENCRYPTION_KEY` no longer blocks NestJS DI / app boot, and add a `RELAX_PROD_VALIDATION` escape hatch for `API_PUBLIC_URL` (mirrors the existing Zoho fields).
