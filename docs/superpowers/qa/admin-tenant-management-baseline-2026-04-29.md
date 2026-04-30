# Admin Tenant Management Baseline - 2026-04-29

Worktree: `/Users/tariq/code/deqah/.worktrees/admin-tenant-management-remediation`
Branch: `feat/admin-tenant-management-remediation`

The main workspace was dirty before this worktree was created. Those existing changes were left untouched.

## Backend

- `npm run prisma:validate --workspace=backend`: PASS
- `npm run typecheck --workspace=backend`: FAIL
  - `src/api/dashboard/people.controller.spec.ts(32,22)`: expected 27 constructor arguments, got 26.
  - `src/api/public/auth.controller.spec.ts(47,22)`: expected 12 constructor arguments, got 10.
  - `src/modules/identity/otp/otp-session.service.spec.ts(27,29)`: missing `organizationId` in OTP session payload.
  - `src/modules/identity/otp/otp-session.service.spec.ts(43,29)`: missing `organizationId` in OTP session payload.
- `npm run lint --workspace=backend`: FAIL
  - Blocking error: `src/infrastructure/database/prisma.service.spec.ts(36,19)` uses `$allTenants` in a spec and trips the restricted syntax rule.
  - Additional baseline noise: 57 warnings, mostly unused imports/variables and unused eslint-disable directives.
- Targeted admin/tenant Jest:
  - Command: `npm run test --workspace=backend -- src/api/admin/organizations.controller.spec.ts src/modules/platform/admin/list-organizations/list-organizations.handler.spec.ts src/modules/platform/admin/get-organization/get-organization.handler.spec.ts src/common/tenant/tenant-resolver.middleware.spec.ts src/common/guards/jwt.guard.spec.ts`
  - Result: PASS, 5 suites and 41 tests.

## Admin App

- `npm run typecheck --workspace=admin`: PASS
- `npm run lint --workspace=admin`: PASS
- `npm run build --workspace=admin`: PASS
  - Non-blocking baseline warnings: Next.js inferred workspace root from multiple lockfiles; webpack cache warnings from dynamic `next-intl` imports.

## Dashboard

- Targeted auth/tenant Vitest:
  - Command: `npm run test --workspace=dashboard -- test/unit/auth/auth-provider.spec.tsx test/unit/components/tenant-switcher.spec.tsx test/unit/lib/auth-api.spec.ts`
  - Result: PASS, 3 files and 30 tests.
- `npm run typecheck --workspace=dashboard`: PASS

## Notes

- Do not use the backend workspace-wide typecheck/lint failures as evidence of a new regression until the touched slice has been checked independently.
- Backend target tests for the tenant/admin slice are currently green before functional changes.
- Admin and dashboard baselines are green before functional changes.
