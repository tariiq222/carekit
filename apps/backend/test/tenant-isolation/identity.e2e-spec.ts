import * as bcrypt from 'bcryptjs';
import { bootHarness, IsolationHarness } from './isolation-harness';

describe('SaaS-02a — identity cluster isolation', () => {
  let h: IsolationHarness;

  beforeAll(async () => {
    h = await bootHarness();
  });

  afterAll(async () => {
    if (h) await h.close();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 1. RefreshToken cross-tenant visibility
  // ─────────────────────────────────────────────────────────────────────────

  it('refresh tokens created in org A are invisible from org B', async () => {
    const orgA = await h.createOrg('id-iso-rt-a', 'منظمة رمز أ');
    const orgB = await h.createOrg('id-iso-rt-b', 'منظمة رمز ب');

    const passwordHash = await bcrypt.hash('Pw!12345', 4);
    const user = await h.prisma.user.create({
      data: {
        email: `iso-rt-${Date.now()}@t.test`,
        passwordHash,
        name: 'RT Test User',
        role: 'RECEPTIONIST',
      },
      select: { id: true },
    });

    // Give the user a membership in orgA — matches real staff users and keeps
    // the SaaS-01 foundation invariant ("every non-CLIENT user has ≥1 active
    // membership") green when both specs run together.
    await h.prisma.membership.create({
      data: { userId: user.id, organizationId: orgA.id, role: 'ADMIN', isActive: true },
    });

    let tokenId: string;

    // Seed a token under org A
    await h.runAs({ organizationId: orgA.id }, async () => {
      const token = await h.prisma.refreshToken.create({
        data: {
          userId: user.id,
          organizationId: orgA.id,
          tokenHash: `hash-${Date.now()}-a`,
          tokenSelector: 'sel-a',
          expiresAt: new Date(Date.now() + 86_400_000),
        },
        select: { id: true },
      });
      tokenId = token.id;
    });

    // Try reading the same token from org B context
    await h.runAs({ organizationId: orgB.id }, async () => {
      const byId = await h.prisma.refreshToken.findUnique({
        where: { id: tokenId! },
      });
      expect(byId).toBeNull();

      const all = await h.prisma.refreshToken.findMany({
        where: { userId: user.id },
      });
      expect(all).toHaveLength(0);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 2. Role names unique per org, not globally
  // ─────────────────────────────────────────────────────────────────────────

  it('role names are unique per org, not globally', async () => {
    const orgA = await h.createOrg('id-role-uniq-a', 'منظمة دور أ');
    const orgB = await h.createOrg('id-role-uniq-b', 'منظمة دور ب');

    // Use a timestamp suffix so re-runs don't hit unique violations
    // (orgs are upserted so the same org ids are reused across runs)
    const roleName = `Supervisor-${Date.now()}`;

    let roleAId: string;
    let roleBId: string;

    await h.runAs({ organizationId: orgA.id }, async () => {
      const role = await h.prisma.customRole.create({
        data: { organizationId: orgA.id, name: roleName },
        select: { id: true },
      });
      roleAId = role.id;
    });

    await h.runAs({ organizationId: orgB.id }, async () => {
      // Must NOT throw unique constraint — different org, same name is fine
      const role = await h.prisma.customRole.create({
        data: { organizationId: orgB.id, name: roleName },
        select: { id: true },
      });
      roleBId = role.id;
    });

    expect(roleAId!).toBeDefined();
    expect(roleBId!).toBeDefined();
    expect(roleAId!).not.toBe(roleBId!);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 3. Deleting role in org A does not affect org B
  // ─────────────────────────────────────────────────────────────────────────

  it('deleting a role in org A does not affect org B roles with same name', async () => {
    const orgA = await h.createOrg('id-del-a', 'منظمة حذف أ');
    const orgB = await h.createOrg('id-del-b', 'منظمة حذف ب');

    // Timestamp suffix to avoid unique violations on reruns (orgs are upserted)
    const roleName = `Clerk-${Date.now()}`;
    let roleAId: string;
    let roleBId: string;

    await h.runAs({ organizationId: orgA.id }, async () => {
      const role = await h.prisma.customRole.create({
        data: { organizationId: orgA.id, name: roleName },
        select: { id: true },
      });
      roleAId = role.id;
    });

    await h.runAs({ organizationId: orgB.id }, async () => {
      const role = await h.prisma.customRole.create({
        data: { organizationId: orgB.id, name: roleName },
        select: { id: true },
      });
      roleBId = role.id;
    });

    // Delete org A's role
    await h.runAs({ organizationId: orgA.id }, async () => {
      await h.prisma.customRole.delete({ where: { id: roleAId! } });
    });

    // Org B's role must still exist
    const surviving = await h.prisma.customRole.findUnique({
      where: { id: roleBId! },
    });
    expect(surviving).not.toBeNull();
    expect(surviving!.name).toBe(roleName);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 4. Permissions scoped through parent role's org
  // ─────────────────────────────────────────────────────────────────────────

  it('permissions are scoped through their parent role org', async () => {
    const orgA = await h.createOrg('id-perm-a', 'منظمة صلاحية أ');
    const orgB = await h.createOrg('id-perm-b', 'منظمة صلاحية ب');

    let roleAId: string;

    await h.runAs({ organizationId: orgA.id }, async () => {
      const role = await h.prisma.customRole.create({
        data: {
          organizationId: orgA.id,
          name: `PermRole-${Date.now()}`,
          permissions: {
            create: [
              {
                organizationId: orgA.id,
                action: 'read',
                subject: 'Booking',
              },
            ],
          },
        },
        select: { id: true },
      });
      roleAId = role.id;
    });

    // Try reading permissions that belong to org A's role, from org B context
    await h.runAs({ organizationId: orgB.id }, async () => {
      const perms = await h.prisma.permission.findMany({
        where: { customRoleId: roleAId! },
      });
      expect(perms).toHaveLength(0);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 5. RLS at SQL level hides rows when org GUC differs
  // ─────────────────────────────────────────────────────────────────────────

  it('RLS at the SQL level also hides rows when org GUC is different', async () => {
    const orgA = await h.createOrg('id-rls-a', 'منظمة RLS أ');
    const orgB = await h.createOrg('id-rls-b', 'منظمة RLS ب');

    // Create the role in org A
    const rlsRoleName = `RLS-Role-${Date.now()}`;
    await h.prisma.customRole.create({
      data: { organizationId: orgA.id, name: rlsRoleName },
    });

    // Open a transaction, set GUC to org B, then switch to a non-superuser role
    // so that PostgreSQL RLS policies actually fire.
    // NOTE: The app connects as `deqah` which is a PostgreSQL superuser.
    // PostgreSQL superusers bypass all RLS policies even with FORCE ROW LEVEL
    // SECURITY (this is documented PostgreSQL behavior). We create a throwaway
    // non-superuser role, probe the table under that role, then clean up.
    const tmpRole = `rls_probe_${Date.now()}`;
    try {
      // Create a minimal non-superuser role with SELECT on CustomRole
      await h.prisma.$executeRawUnsafe(`CREATE ROLE ${tmpRole}`);
      await h.prisma.$executeRawUnsafe(`GRANT SELECT ON "CustomRole" TO ${tmpRole}`);

      await h.prisma.$transaction(async (tx) => {
        // Set GUC first — must happen while still superuser
        await tx.$executeRawUnsafe(`SET LOCAL app.current_org_id = '${orgB.id}'`);
        // Drop to non-superuser so RLS policies are evaluated
        await tx.$executeRawUnsafe(`SET LOCAL ROLE ${tmpRole}`);

        const rows = await tx.$queryRaw<Array<{ cnt: bigint }>>`
          SELECT COUNT(*)::bigint AS cnt FROM "CustomRole" WHERE name = ${rlsRoleName}
        `;
        // With GUC set to org B and the role belonging to org A, RLS hides the row
        expect(Number(rows[0].cnt)).toBe(0);
      });
    } finally {
      // Revoke before drop — GRANT SELECT created a dependency that blocks DROP
      await h.prisma
        .$executeRawUnsafe(`REVOKE ALL ON "CustomRole" FROM ${tmpRole}`)
        .catch(() => {
          /* ignore if already cleaned up */
        });
      await h.prisma.$executeRawUnsafe(`DROP ROLE IF EXISTS ${tmpRole}`).catch(() => {
        /* ignore */
      });
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 6. Super-admin context bypasses scoping
  // ─────────────────────────────────────────────────────────────────────────

  it('super-admin context bypasses scoping (read-all)', async () => {
    const orgA = await h.createOrg('id-sa-a', 'منظمة مدير عام أ');

    await h.runAs({ organizationId: orgA.id }, async () => {
      await h.prisma.customRole.create({
        data: {
          organizationId: orgA.id,
          name: `SA-Role-${Date.now()}`,
        },
      });
    });

    // Super-admin should see >= 1 role across all orgs
    let count = 0;
    await h.runAs({ isSuperAdmin: true }, async () => {
      const roles = await h.prisma.customRole.findMany();
      count = roles.length;
    });

    expect(count).toBeGreaterThanOrEqual(1);
  });
});
