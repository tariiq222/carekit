import { bootHarness, IsolationHarness } from './isolation-harness';

describe('SaaS-02b — people cluster isolation', () => {
  let h: IsolationHarness;

  beforeAll(async () => {
    h = await bootHarness();
  });

  afterAll(async () => {
    if (h) await h.close();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 1. Client — same phone is allowed in two orgs
  // ───────────────────────────────────────────────────────────────────────────

  it('same phone can belong to two clients in different orgs', async () => {
    const a = await h.createOrg('ppl-iso-phone-a', 'منظمة أ');
    const b = await h.createOrg('ppl-iso-phone-b', 'منظمة ب');
    const phone = `+96650${Date.now().toString().slice(-7)}`;

    const cA = await h.runAs({ organizationId: a.id }, () =>
      h.prisma.client.create({
        data: {
          organizationId: a.id,
          name: 'Iso A',
          phone,
          accountType: 'FULL',
          source: 'ONLINE',
        },
        select: { id: true },
      }),
    );

    const cB = await h.runAs({ organizationId: b.id }, () =>
      h.prisma.client.create({
        data: {
          organizationId: b.id,
          name: 'Iso B',
          phone,
          accountType: 'FULL',
          source: 'ONLINE',
        },
        select: { id: true },
      }),
    );

    expect(cA.id).not.toBe(cB.id);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 2. Client created in org A is invisible from org B
  // ───────────────────────────────────────────────────────────────────────────

  it('client created in org A is invisible from org B', async () => {
    const a = await h.createOrg('ppl-iso-vis-a', 'منظمة أ');
    const b = await h.createOrg('ppl-iso-vis-b', 'منظمة ب');

    const created = await h.runAs({ organizationId: a.id }, async () =>
      h.prisma.client.create({
        data: {
          organizationId: a.id,
          name: 'Hidden',
          phone: `+966${Date.now()}1`,
          accountType: 'FULL',
          source: 'ONLINE',
        },
        select: { id: true },
      }),
    );

    let fromB: Awaited<ReturnType<typeof h.prisma.client.findFirst>>;
    await h.runAs({ organizationId: b.id }, async () => {
      fromB = await h.prisma.client.findFirst({ where: { id: created.id } });
    });

    expect(fromB!).toBeNull();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 3. Employee slug is unique per org (same slug allowed in two orgs)
  // ───────────────────────────────────────────────────────────────────────────

  it('employee slug is unique per org (same slug in two orgs is allowed)', async () => {
    const a = await h.createOrg('ppl-iso-slug-a', 'منظمة أ');
    const b = await h.createOrg('ppl-iso-slug-b', 'منظمة ب');
    const slug = `dr-${Date.now()}`;

    const eA = await h.runAs({ organizationId: a.id }, () =>
      h.prisma.employee.create({
        data: { organizationId: a.id, name: 'Dr A', slug },
        select: { id: true },
      }),
    );

    const eB = await h.runAs({ organizationId: b.id }, () =>
      h.prisma.employee.create({
        data: { organizationId: b.id, name: 'Dr B', slug },
        select: { id: true },
      }),
    );

    expect(eA.id).not.toBe(eB.id);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 4. EmployeeAvailability inherits org from parent
  // ───────────────────────────────────────────────────────────────────────────

  it('employee availability rows carry the parent org', async () => {
    const a = await h.createOrg('ppl-iso-avail-a', 'منظمة أ');

    const e = await h.runAs({ organizationId: a.id }, () =>
      h.prisma.employee.create({
        data: { organizationId: a.id, name: 'Dr Avail', slug: `dr-av-${Date.now()}` },
        select: { id: true },
      }),
    );

    const av = await h.runAs({ organizationId: a.id }, () =>
      h.prisma.employeeAvailability.create({
        data: {
          employeeId: e.id,
          organizationId: a.id,
          dayOfWeek: 1,
          startTime: '09:00',
          endTime: '17:00',
        },
        select: { id: true, organizationId: true },
      }),
    );

    expect(av.organizationId).toBe(a.id);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 5. ClientRefreshToken is scoped
  // ───────────────────────────────────────────────────────────────────────────

  it('client refresh tokens are scoped by org', async () => {
    const a = await h.createOrg('ppl-iso-crt-a', 'منظمة أ');
    const b = await h.createOrg('ppl-iso-crt-b', 'منظمة ب');

    let cA: { id: string };
    await h.runAs({ organizationId: a.id }, async () => {
      cA = await h.prisma.client.create({
        data: {
          organizationId: a.id,
          name: 'CA',
          phone: `+966${Date.now()}2`,
          accountType: 'FULL',
          source: 'ONLINE',
        },
        select: { id: true },
      });
    });

    await h.runAs({ organizationId: a.id }, async () => {
      await h.prisma.clientRefreshToken.create({
        data: {
          clientId: cA!.id,
          organizationId: a.id,
          tokenHash: `hash-${Date.now()}`,
          tokenSelector: 'sel',
          expiresAt: new Date(Date.now() + 86_400_000),
        },
      });
    });

    let fromB: Awaited<ReturnType<typeof h.prisma.clientRefreshToken.findMany>>;
    await h.runAs({ organizationId: b.id }, async () => {
      fromB = await h.prisma.clientRefreshToken.findMany({ where: { clientId: cA!.id } });
    });

    expect(fromB!).toEqual([]);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 6. RLS hides people rows at SQL level when GUC differs
  // ───────────────────────────────────────────────────────────────────────────

  it('RLS hides employee rows at SQL level when GUC differs', async () => {
    const a = await h.createOrg('ppl-iso-rls-a', 'منظمة أ');
    const b = await h.createOrg('ppl-iso-rls-b', 'منظمة ب');

    // Seed an employee under org A. Use a raw INSERT (no extension scoping on writes)
    // so we bypass the tenant scoping extension — GUC filtering is only meaningful
    // for the subsequent read.
    const witnessSlug = `rls-${Date.now()}`;
    await h.prisma.$executeRawUnsafe(
      `INSERT INTO "Employee" (id, "organizationId", name, slug, "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, 'RLS Witness', $2, now(), now())`,
      a.id,
      witnessSlug,
    );

    // Open a transaction, set GUC to org B, then switch to a non-superuser role
    // so that PostgreSQL RLS policies actually fire.
    // NOTE: The app connects as `deqah` which is a PostgreSQL superuser.
    // PostgreSQL superusers bypass all RLS policies even with FORCE ROW LEVEL
    // SECURITY (documented PostgreSQL behaviour). We create a throwaway
    // non-superuser role, probe the table under that role, then clean up.
    const tmpRole = `rls_probe_ppl_${Date.now()}`;
    try {
      await h.prisma.$executeRawUnsafe(`CREATE ROLE ${tmpRole}`);
      await h.prisma.$executeRawUnsafe(`GRANT SELECT ON "Employee" TO ${tmpRole}`);

      const rows = await h.prisma.$transaction(async (tx) => {
        // Set GUC first — must happen while still superuser
        await tx.$executeRawUnsafe(`SET LOCAL app.current_org_id = '${b.id}'`);
        // Drop to non-superuser so RLS policies are evaluated
        await tx.$executeRawUnsafe(`SET LOCAL ROLE ${tmpRole}`);

        return tx.$queryRaw<Array<{ cnt: bigint }>>`
          SELECT COUNT(*)::bigint AS cnt FROM "Employee" WHERE name = 'RLS Witness'
        `;
      });

      // With GUC set to org B and the employee belonging to org A, RLS hides the row.
      // If this assertion flips to non-zero, the test DB role is a superuser and
      // RLS is ineffective. See saas-tenancy.md.
      expect(Number(rows[0].cnt)).toBe(0);
    } finally {
      await h.prisma
        .$executeRawUnsafe(`REVOKE ALL ON "Employee" FROM ${tmpRole}`)
        .catch(() => {
          /* ignore if already cleaned up */
        });
      await h.prisma.$executeRawUnsafe(`DROP ROLE IF EXISTS ${tmpRole}`).catch(() => {
        /* ignore */
      });
    }
  });
});
