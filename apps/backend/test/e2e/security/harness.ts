/**
 * Shared harness for the cross-tenant penetration suite (SaaS-02h).
 *
 * Wraps the existing isolation-harness with adversarial helpers:
 *   - `rlsProbeUrl()` — DSN for the non-superuser role that the Postgres RLS
 *     backstop tests use. The superuser bypasses RLS even with FORCE;
 *     `carekit_rls_probe` was created in migration 20260422180000.
 *   - `withCls(orgId, fn)` — sugar over `runAs` with just an org id.
 *   - `seedTwoOrgs()` — standard Org A / Org B pair used by every suite.
 *
 * The penetration suite runs under `TENANT_ENFORCEMENT=strict` (the 02h
 * default). Do not set any other mode here — the whole point is to prove
 * strict mode fails closed.
 */
import { bootHarness, IsolationHarness } from '../../tenant-isolation/isolation-harness';

export interface SecurityHarness extends IsolationHarness {
  withCls: <T>(organizationId: string, fn: () => Promise<T>) => Promise<T>;
  seedTwoOrgs: (suiteTag: string) => Promise<{ orgA: { id: string }; orgB: { id: string } }>;
  rlsProbeUrl: () => string;
}

const RLS_PROBE_DB =
  process.env.TEST_DATABASE_URL ??
  'postgresql://carekit:carekit_dev_password@127.0.0.1:5999/carekit_test?schema=public';

/**
 * The probe role was created in migration 20260422180000 with this password.
 * Test-only — has no write grants anywhere.
 */
const RLS_PROBE_PASSWORD = 'rls_probe_test_only_2026';

export async function bootSecurityHarness(): Promise<SecurityHarness> {
  // Force the app to connect to the test DB (not dev). The isolation-harness
  // boots AppModule which reads process.env.DATABASE_URL; without this swap
  // tests would land in carekit_dev where the 02h migrations (probe role,
  // bookings RLS) are not applied.
  if (process.env.TEST_DATABASE_URL) {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  }
  const base = await bootHarness();

  // Must be async inside so the ALS context carries through the Promise
  // resolution — returning a Promise directly from cls.run(fn) can drop the
  // context in continuations. Confirmed empirically against the isolation
  // harness; the existing booking-isolation tests always wrap in `async () => { ... }`.
  const withCls = <T>(organizationId: string, fn: () => Promise<T>): Promise<T> =>
    base.runAs({ organizationId }, async () => fn());

  const seedTwoOrgs = async (suiteTag: string) => {
    const stamp = Date.now();
    const orgA = await base.createOrg(`sec-${suiteTag}-a-${stamp}`, `منظمة أمن أ ${suiteTag}`);
    const orgB = await base.createOrg(`sec-${suiteTag}-b-${stamp}`, `منظمة أمن ب ${suiteTag}`);
    return { orgA, orgB };
  };

  const rlsProbeUrl = (): string => {
    // Swap username/password into the TEST_DATABASE_URL.
    // Parse scheme://user:pass@host:port/db?query
    const url = new URL(RLS_PROBE_DB);
    url.username = 'carekit_rls_probe';
    url.password = RLS_PROBE_PASSWORD;
    return url.toString();
  };

  return { ...base, withCls, seedTwoOrgs, rlsProbeUrl };
}
