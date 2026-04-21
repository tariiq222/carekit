import { bootHarness, IsolationHarness } from './isolation-harness';

describe('SaaS-02c — org-config cluster isolation', () => {
  let h: IsolationHarness;

  beforeAll(async () => {
    h = await bootHarness();
  });

  afterAll(async () => {
    if (h) await h.close();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 1. Branch — same nameAr allowed in two orgs; invisible cross-org
  // ──────────────────────────────────────────────────────────────────────────

  it('branch created in org A is invisible from org B', async () => {
    const a = await h.createOrg(`cfg-br-a-${Date.now()}`, 'منظمة فروع أ');
    const b = await h.createOrg(`cfg-br-b-${Date.now()}`, 'منظمة فروع ب');

    const created = await h.runAs({ organizationId: a.id }, () =>
      h.prisma.branch.create({
        data: { organizationId: a.id, nameAr: 'فرع رئيسي' },
        select: { id: true },
      }),
    );

    let fromB: Awaited<ReturnType<typeof h.prisma.branch.findFirst>>;
    await h.runAs({ organizationId: b.id }, async () => {
      fromB = await h.prisma.branch.findFirst({ where: { id: created.id } });
    });

    expect(fromB!).toBeNull();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 2. Department — same nameAr allowed in two orgs
  // ──────────────────────────────────────────────────────────────────────────

  it('same department nameAr allowed in two orgs (cross-org unique lifted)', async () => {
    const a = await h.createOrg(`cfg-dept-a-${Date.now()}`, 'منظمة أقسام أ');
    const b = await h.createOrg(`cfg-dept-b-${Date.now()}`, 'منظمة أقسام ب');

    const dA = await h.runAs({ organizationId: a.id }, () =>
      h.prisma.department.create({
        data: { organizationId: a.id, nameAr: 'عيادة عامة' },
        select: { id: true },
      }),
    );

    const dB = await h.runAs({ organizationId: b.id }, () =>
      h.prisma.department.create({
        data: { organizationId: b.id, nameAr: 'عيادة عامة' },
        select: { id: true },
      }),
    );

    expect(dA.id).not.toBe(dB.id);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 3. ServiceCategory — scoped by org
  // ──────────────────────────────────────────────────────────────────────────

  it('service category created in org A is invisible from org B', async () => {
    const a = await h.createOrg(`cfg-cat-a-${Date.now()}`, 'منظمة فئات أ');
    const b = await h.createOrg(`cfg-cat-b-${Date.now()}`, 'منظمة فئات ب');

    const cat = await h.runAs({ organizationId: a.id }, () =>
      h.prisma.serviceCategory.create({
        data: { organizationId: a.id, nameAr: 'فئة تجريبية' },
        select: { id: true },
      }),
    );

    let fromB: Awaited<ReturnType<typeof h.prisma.serviceCategory.findFirst>>;
    await h.runAs({ organizationId: b.id }, async () => {
      fromB = await h.prisma.serviceCategory.findFirst({ where: { id: cat.id } });
    });

    expect(fromB!).toBeNull();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 4. BusinessHour — denormalized organizationId inherited from Branch
  // ──────────────────────────────────────────────────────────────────────────

  it('business hours carry the parent branch org', async () => {
    const a = await h.createOrg(`cfg-bh-a-${Date.now()}`, 'منظمة ساعات أ');

    const branch = await h.runAs({ organizationId: a.id }, () =>
      h.prisma.branch.create({
        data: { organizationId: a.id, nameAr: 'فرع الساعات' },
        select: { id: true },
      }),
    );

    const bh = await h.runAs({ organizationId: a.id }, () =>
      h.prisma.businessHour.create({
        data: {
          organizationId: a.id,
          branchId: branch.id,
          dayOfWeek: 0,
          startTime: '09:00',
          endTime: '17:00',
        },
        select: { id: true, organizationId: true },
      }),
    );

    expect(bh.organizationId).toBe(a.id);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 5. RLS hides Branch rows at SQL level when GUC differs
  // ──────────────────────────────────────────────────────────────────────────

  it('RLS hides branch rows at SQL level when GUC differs', async () => {
    const a = await h.createOrg(`cfg-rls-a-${Date.now()}`, 'منظمة RLS أ');
    const b = await h.createOrg(`cfg-rls-b-${Date.now()}`, 'منظمة RLS ب');

    const witnessName = `rls-branch-${Date.now()}`;
    await h.prisma.$executeRawUnsafe(
      `INSERT INTO "Branch" (id, "organizationId", "nameAr", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, now(), now())`,
      a.id,
      witnessName,
    );

    const tmpRole = `rls_probe_cfg_${Date.now()}`;
    try {
      await h.prisma.$executeRawUnsafe(`CREATE ROLE ${tmpRole}`);
      await h.prisma.$executeRawUnsafe(`GRANT SELECT ON "Branch" TO ${tmpRole}`);

      const rows = await h.prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`SET LOCAL app.current_org_id = '${b.id}'`);
        await tx.$executeRawUnsafe(`SET LOCAL ROLE ${tmpRole}`);
        return tx.$queryRaw<Array<{ cnt: bigint }>>`
          SELECT COUNT(*)::bigint AS cnt FROM "Branch" WHERE "nameAr" = ${witnessName}
        `;
      });

      expect(Number(rows[0].cnt)).toBe(0);
    } finally {
      await h.prisma.$executeRawUnsafe(`REVOKE ALL ON "Branch" FROM ${tmpRole}`).catch(() => {});
      await h.prisma.$executeRawUnsafe(`DROP ROLE IF EXISTS ${tmpRole}`).catch(() => {});
    }
  });
});
