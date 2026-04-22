# Cross-tenant penetration suite (SaaS-02h)

Runs under `TENANT_ENFORCEMENT=strict` (the platform default as of 02h).
Seeds two orgs per case, plays attacker-vs-defender scenarios, asserts Org A
data is unreachable from Org B.

## Local run

    cd apps/backend
    npm run test:security

The suite needs the test DB + migrations applied (including
`20260422180000_saas_02h_rls_probe_role`), Redis up, and the
`SMS_PROVIDER_ENCRYPTION_KEY` env var.

## CI

The suite runs as a required gate in `.github/workflows/ci.yml` under
`backend` → `Cross-tenant penetration suite`. Branch protection treats it as
a required check (manual configuration in GitHub settings).

## Vectors covered

| Vector | Spec |
|---|---|
| Direct-id probe (findFirst cross-org → null) | `cross-tenant-penetration.e2e-spec.ts` |
| Bulk-probe (findMany never returns rival rows) | `cross-tenant-penetration.e2e-spec.ts` |
| FK injection (referencing another org's parent) | `cross-tenant-penetration.e2e-spec.ts` |
| Coupon code collision (MUST succeed — per-org namespace) | `cross-tenant-penetration.e2e-spec.ts` |
| RLS backstop under non-superuser probe role | `rls-backstop.e2e-spec.ts` |
| Strict-mode fail-closed (`requireOrganizationId` throws) | `strict-mode-enforcement.e2e-spec.ts` |
| Moyasar webhook forgery (bad sig + bogus metadata) | `moyasar-webhook-forgery.e2e-spec.ts` |
| systemContext abuse (no auth-path write sites) | `moyasar-webhook-forgery.e2e-spec.ts` |

## Adding a test

1. Extend `harness.ts` with any new adversarial helper.
2. Add a new `it(...)` block to an existing spec, or a new `*.e2e-spec.ts`.
3. Update the table above if the new test expands coverage.
