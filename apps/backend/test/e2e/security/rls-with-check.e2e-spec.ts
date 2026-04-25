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
 * Why a temporary role: the test harness connects as the DB owner (superuser
 * in dev) which bypasses RLS regardless of FORCE. We mirror the pattern from
 * `tenant-isolation/singletons`: create a non-superuser role with minimum
 * grants for the test, switch to it via `SET LOCAL ROLE` inside the
 * transaction, then drop it.
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

  type RawTx = { $executeRawUnsafe: (sql: string) => Promise<unknown> };

  const runUnderProbeRole = async <T>(
    orgId: string,
    tables: ReadonlyArray<string>,
    op: (tx: RawTx) => Promise<T>,
  ): Promise<T> => {
    const tmpRole = `rls_probe_wc_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
    try {
      await h.prisma.$executeRawUnsafe(`CREATE ROLE ${tmpRole}`);
      await h.prisma.$executeRawUnsafe(`GRANT USAGE ON SCHEMA public TO ${tmpRole}`);
      for (const table of tables) {
        await h.prisma.$executeRawUnsafe(
          `GRANT SELECT, INSERT, UPDATE, DELETE ON public."${table}" TO ${tmpRole}`,
        );
      }
      return await h.prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`SET LOCAL app.current_org_id = '${orgId}'`);
        await tx.$executeRawUnsafe(`SET LOCAL ROLE ${tmpRole}`);
        return op(tx);
      });
    } finally {
      for (const table of tables) {
        await h.prisma
          .$executeRawUnsafe(`REVOKE ALL ON public."${table}" FROM ${tmpRole}`)
          .catch(() => {});
      }
      await h.prisma
        .$executeRawUnsafe(`REVOKE USAGE ON SCHEMA public FROM ${tmpRole}`)
        .catch(() => {});
      await h.prisma.$executeRawUnsafe(`DROP ROLE IF EXISTS ${tmpRole}`).catch(() => {});
    }
  };

  const insertBranch = (orgId: string, marker: string) =>
    `INSERT INTO public."Branch" ("id", "organizationId", "nameAr", "country", "isActive", "isMain", "timezone", "createdAt", "updatedAt")
     VALUES (gen_random_uuid(), '${orgId}', '${marker}', 'SA', true, false, 'Asia/Riyadh', NOW(), NOW())`;

  describe('INSERT', () => {
    it('rejects raw INSERT into Branch with a foreign organizationId', async () => {
      const { orgA, orgB } = await h.seedTwoOrgs('wc-insert-foreign');

      const attempt = runUnderProbeRole(orgA.id, ['Branch'], async (tx) => {
        await tx.$executeRawUnsafe(insertBranch(orgB.id, 'evil-branch'));
      });

      await expect(attempt).rejects.toThrow(/row-level security/i);
    });

    it('allows raw INSERT into Branch when organizationId matches the tenant context', async () => {
      const { orgA } = await h.seedTwoOrgs('wc-insert-same');

      await runUnderProbeRole(orgA.id, ['Branch'], async (tx) => {
        await tx.$executeRawUnsafe(insertBranch(orgA.id, 'good-branch'));
      });

      const count = await h.withCls(orgA.id, () =>
        h.prisma.branch.count({ where: { organizationId: orgA.id, nameAr: 'good-branch' } }),
      );
      expect(count).toBeGreaterThan(0);
    });

    it('rejects raw INSERT into Booking with a foreign organizationId', async () => {
      const { orgA, orgB } = await h.seedTwoOrgs('wc-insert-booking');

      const attempt = runUnderProbeRole(orgA.id, ['Booking'], async (tx) => {
        await tx.$executeRawUnsafe(
          `INSERT INTO public."Booking" ("id", "organizationId", "branchId", "clientId", "employeeId", "serviceId", "scheduledAt", "endsAt", "durationMins", "price", "currency", "createdAt", "updatedAt")
           VALUES (gen_random_uuid(), '${orgB.id}', 'b-x', 'c-x', 'e-x', 's-x', NOW(), NOW() + INTERVAL '1 hour', 60, 100, 'SAR', NOW(), NOW())`,
        );
      });

      await expect(attempt).rejects.toThrow(/row-level security/i);
    });
  });

  describe('UPDATE', () => {
    it('rejects raw UPDATE that moves a Branch row to a foreign tenant', async () => {
      const { orgA, orgB } = await h.seedTwoOrgs('wc-update-move');

      // Seed a Branch in orgA via the privileged client (bypasses RLS).
      const seeded = await h.prisma.$queryRawUnsafe<Array<{ id: string }>>(
        `INSERT INTO public."Branch" ("id", "organizationId", "nameAr", "country", "isActive", "isMain", "timezone", "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), '${orgA.id}', 'movable', 'SA', true, false, 'Asia/Riyadh', NOW(), NOW())
         RETURNING id`,
      );
      const branchId = seeded[0]!.id;

      // Attempt to move it to orgB under orgA's tenant context.
      const attempt = runUnderProbeRole(orgA.id, ['Branch'], async (tx) => {
        await tx.$executeRawUnsafe(
          `UPDATE public."Branch" SET "organizationId" = '${orgB.id}' WHERE "id" = '${branchId}'`,
        );
      });

      await expect(attempt).rejects.toThrow(/row-level security/i);

      // Confirm the row stayed in orgA.
      const stillInA = await h.withCls(orgA.id, () =>
        h.prisma.branch.findUnique({ where: { id: branchId } }),
      );
      expect(stillInA?.organizationId).toBe(orgA.id);
    });
  });
});
