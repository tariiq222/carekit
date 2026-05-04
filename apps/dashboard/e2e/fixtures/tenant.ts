/**
 * e2e/fixtures/tenant.ts
 *
 * Per-test tenant isolation helpers for Playwright e2e tests.
 *
 * In a multi-tenant system every e2e test should run against a dedicated
 * throwaway organization so tests are fully isolated from each other and
 * from the seeded dev data.
 *
 * Full implementation is out of scope for the initial restructure.
 * Stubs with TODO comments are provided for the intended API.
 *
 * Usage pattern (intended, not yet implemented):
 *   import { createTestTenant, destroyTestTenant } from '../fixtures/tenant';
 *
 *   let tenantId: string;
 *   test.beforeEach(async () => { tenantId = await createTestTenant(); });
 *   test.afterEach(async () => { await destroyTestTenant(tenantId); });
 */

export interface TestTenant {
  id: string;
  slug: string;
  nameAr: string;
  nameEn: string;
  /** JWT for the auto-created owner of this test tenant */
  ownerToken: string;
}

/**
 * Create a throwaway tenant via the super-admin API.
 *
 * TODO (tenant.ts): call POST /admin/organizations with a service-account
 * token stored in SEED_ADMIN_TOKEN env var.  The tenant should be
 * auto-tagged with { deletable: true } so the nightly cleanup cron can
 * sweep them up even if afterEach fails.
 */
export async function createTestTenant(
  _overrides?: Partial<Pick<TestTenant, 'nameAr' | 'nameEn' | 'slug'>>,
): Promise<TestTenant> {
  throw new Error('TODO: createTestTenant not yet implemented — see e2e/fixtures/tenant.ts');
}

/**
 * Destroy a throwaway tenant and all its data.
 *
 * TODO (tenant.ts): call DELETE /admin/organizations/:id with the service-
 * account token.  Safe-guard: verify the org has the deletable tag before
 * issuing the delete to prevent accidental production data loss.
 */
export async function destroyTestTenant(_tenantId: string): Promise<void> {
  throw new Error('TODO: destroyTestTenant not yet implemented — see e2e/fixtures/tenant.ts');
}

/**
 * Return the base URL for a given tenant slug.
 * Useful when the dashboard uses subdomain-based tenant routing.
 *
 * TODO (tenant.ts): align with the tenant resolver strategy (subdomain vs
 * header vs path) once the e2e environment topology is finalised.
 */
export function tenantBaseUrl(slug: string): string {
  const base = process.env.PW_DASHBOARD_URL ?? 'http://localhost:5103';
  // Placeholder — adjust once subdomain routing is confirmed for e2e env.
  return `${base}?org=${slug}`;
}
