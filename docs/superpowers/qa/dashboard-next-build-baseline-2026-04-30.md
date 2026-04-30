# Dashboard Next Build Baseline Note

**Date:** 2026-04-30
**Context:** Tenant billing Phase 2 verification after merge to `main`, then Phase 3 final verification in `feat/tenant-billing-phase-3`.

## Finding

`npm run build --workspace=dashboard` reaches a successful Next.js compile, then fails during the build-time ESLint phase on pre-existing dashboard files outside the tenant billing Phase 2 and Phase 3 scopes.

Representative blockers:

- `apps/dashboard/components/features/content/hero-form.tsx` — `react-hooks/static-components`
- `apps/dashboard/components/features/employees/public-profile-tab.tsx` — `react-hooks/set-state-in-effect`
- `apps/dashboard/components/features/login-form.tsx` — `react-hooks/set-state-in-effect`
- `apps/dashboard/components/features/route-progress.tsx` — `react-hooks/set-state-in-effect`
- `apps/dashboard/components/features/services/service-form-page.tsx` — `react-hooks/set-state-in-effect`, `react-hooks/refs`
- Multiple settings cards under `apps/dashboard/components/features/settings/*` — `react-hooks/set-state-in-effect`
- `apps/dashboard/components/features/sms/sms-settings-form.tsx` — `react-hooks/set-state-in-effect`

## Impact

This is not a Phase 2 or Phase 3 regression. Billing files passed scoped lint, dashboard typecheck, dashboard i18n parity, and targeted Vitest coverage. The full dashboard production build remains blocked by older React hook lint violations in unrelated feature areas.

## Recommended Owner Phase

Handle this in Phase 8, `Usage page + overview polish`, before full pre-production gates in Phase 10.

## Re-run Command

```bash
npm run build --workspace=dashboard
```
