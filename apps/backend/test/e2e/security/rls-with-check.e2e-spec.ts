/**
 * Tenant RLS Hardening — WITH CHECK penetration spec.
 *
 * The RLS hardening migration (20260425120000_saas_rls_hardening) unified all
 * 58 tenant policies on `app_current_org_id()` AND added a `WITH CHECK` clause
 * to every policy. The `USING` clause filters reads; the `WITH CHECK` clause
 * is what blocks an INSERT/UPDATE that would write a foreign-tenant row.
 *
 * This spec is the regression guard for that load-bearing change. The Prisma
 * `$extends` tenant-scoping extension already prevents cross-tenant writes at
 * the application layer, but raw SQL (`$executeRawUnsafe`, `$queryRawUnsafe`)
 * bypasses the extension. WITH CHECK is the database-level backstop that
 * stops a future contributor from accidentally smuggling a foreign-tenant
 * write past Prisma.
 *
 * Why a temporary role: Branch has ENABLE RLS but not FORCE RLS, and the
 * test harness connects as the DB owner (superuser in dev) which bypasses
 * RLS regardless. We mirror the pattern from `tenant-isolation/singletons`:
 * create a non-superuser role with the minimum grants for the test, switch
 * to it via `SET LOCAL ROLE` inside the transaction, then drop it.
 */
import { bootSecurityHarness, SecurityHarness } from './harness';

describe('Tenant RLS Hardening — WITH CHECK blocks cross-tenant writes', () => {
  let h: SecurityHarness;

  beforeAll(async () => {
    h = await bootSecurityHarness();
  });

  afterAll(async () => {
    if (h) await h.close();
  });

  const insertBranch = (orgId: string) =>
    `INSERT INTO public."Branch" ("id", "organizationId", "nameAr", "country", "isActive", "isMain", "timezone", "createdAt", "updatedAt")
     VALUES (gen_random_uuid(), '${orgId}', 'فرع اختبار', 'SA', true, false, 'Asia/Riyadh', NOW(), NOW())`;

  const runUnderProbeRole = async <T>(
    orgId: string,
    op: (tx: { $executeRawUnsafe: (sql: string) => Promise<unknown> }) => Promise<T>,
  ): Promise<T> => {
    const tmpRole = `rls_probe_wc_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
    try {
      await h.prisma.$executeRawUnsafe(`CREATE ROLE ${tmpRole}`);
      await h.prisma.$executeRawUnsafe(`GRANT USAGE ON SCHEMA public TO ${tmpRole}`);
      await h.prisma.$executeRawUnsafe(
        `GRANT SELECT, INSERT, UPDATE, DELETE ON public."Branch" TO ${tmpRole}`,
      );
      return await h.prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`SET LOCAL app.current_org_id = '${orgId}'`);
        await tx.$executeRawUnsafe(`SET LOCAL ROLE ${tmpRole}`);
        return op(tx);
      });
    } finally {
      await h.prisma
        .$executeRawUnsafe(`REVOKE ALL ON public."Branch" FROM ${tmpRole}`)
        .catch(() => {});
      await h.prisma
        .$executeRawUnsafe(`REVOKE USAGE ON SCHEMA public FROM ${tmpRole}`)
        .catch(() => {});
      await h.prisma.$executeRawUnsafe(`DROP ROLE IF EXISTS ${tmpRole}`).catch(() => {});
    }
  };

  it('rejects raw INSERT into Branch with a foreign organizationId (RLS WITH CHECK)', async () => {
    const { orgA, orgB } = await h.seedTwoOrgs('with-check-foreign');

    const attempt = runUnderProbeRole(orgA.id, async (tx) => {
      await tx.$executeRawUnsafe(insertBranch(orgB.id));
    });

    await expect(attempt).rejects.toThrow(/row-level security/i);
  });

  it('allows raw INSERT into Branch when organizationId matches the tenant context', async () => {
    const { orgA } = await h.seedTwoOrgs('with-check-same');

    await runUnderProbeRole(orgA.id, async (tx) => {
      await tx.$executeRawUnsafe(insertBranch(orgA.id));
    });

    const count = await h.withCls(orgA.id, () =>
      h.prisma.branch.count({ where: { organizationId: orgA.id, nameAr: 'فرع اختبار' } }),
    );
    expect(count).toBeGreaterThan(0);
  });
});
