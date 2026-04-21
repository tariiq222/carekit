import { bootHarness, IsolationHarness } from './isolation-harness';

describe('SaaS-02c — singleton conversion isolation (BrandingConfig + OrganizationSettings)', () => {
  let h: IsolationHarness;

  beforeAll(async () => {
    h = await bootHarness();
  });

  afterAll(async () => {
    if (h) await h.close();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 1. BrandingConfig — one row per org, unique on organizationId
  // ──────────────────────────────────────────────────────────────────────────

  it('each org gets its own BrandingConfig row (not a shared singleton)', async () => {
    const a = await h.createOrg(`sg-brand-a-${Date.now()}`, 'منظمة علامة أ');
    const b = await h.createOrg(`sg-brand-b-${Date.now()}`, 'منظمة علامة ب');

    const bA = await h.runAs({ organizationId: a.id }, () =>
      h.prisma.brandingConfig.create({
        data: { organizationId: a.id, organizationNameAr: 'علامة أ', colorPrimary: '#AA0000' },
        select: { id: true, organizationId: true, colorPrimary: true },
      }),
    );

    const bB = await h.runAs({ organizationId: b.id }, () =>
      h.prisma.brandingConfig.create({
        data: { organizationId: b.id, organizationNameAr: 'علامة ب', colorPrimary: '#0000BB' },
        select: { id: true, organizationId: true, colorPrimary: true },
      }),
    );

    expect(bA.id).not.toBe(bB.id);
    expect(bA.organizationId).toBe(a.id);
    expect(bB.organizationId).toBe(b.id);
    expect(bA.colorPrimary).toBe('#AA0000');
    expect(bB.colorPrimary).toBe('#0000BB');
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 2. BrandingConfig — org A cannot read org B's branding
  // ──────────────────────────────────────────────────────────────────────────

  it('branding config created in org A is invisible from org B', async () => {
    const a = await h.createOrg(`sg-brand-vis-a-${Date.now()}`, 'منظمة علامة رؤية أ');
    const b = await h.createOrg(`sg-brand-vis-b-${Date.now()}`, 'منظمة علامة رؤية ب');

    const rowA = await h.runAs({ organizationId: a.id }, () =>
      h.prisma.brandingConfig.create({
        data: { organizationId: a.id, organizationNameAr: 'علامة خاصة' },
        select: { id: true },
      }),
    );

    let fromB: Awaited<ReturnType<typeof h.prisma.brandingConfig.findFirst>>;
    await h.runAs({ organizationId: b.id }, async () => {
      fromB = await h.prisma.brandingConfig.findFirst({ where: { id: rowA.id } });
    });

    expect(fromB!).toBeNull();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 3. OrganizationSettings — one row per org
  // ──────────────────────────────────────────────────────────────────────────

  it('each org gets its own OrganizationSettings row', async () => {
    const a = await h.createOrg(`sg-settings-a-${Date.now()}`, 'منظمة إعدادات أ');
    const b = await h.createOrg(`sg-settings-b-${Date.now()}`, 'منظمة إعدادات ب');

    const sA = await h.runAs({ organizationId: a.id }, () =>
      h.prisma.organizationSettings.create({
        data: { organizationId: a.id, companyNameAr: 'شركة أ' },
        select: { id: true, organizationId: true },
      }),
    );

    const sB = await h.runAs({ organizationId: b.id }, () =>
      h.prisma.organizationSettings.create({
        data: { organizationId: b.id, companyNameAr: 'شركة ب' },
        select: { id: true, organizationId: true },
      }),
    );

    expect(sA.id).not.toBe(sB.id);
    expect(sA.organizationId).toBe(a.id);
    expect(sB.organizationId).toBe(b.id);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 4. OrganizationSettings — org A cannot read org B's settings
  // ──────────────────────────────────────────────────────────────────────────

  it('organization settings created in org A are invisible from org B', async () => {
    const a = await h.createOrg(`sg-settings-vis-a-${Date.now()}`, 'منظمة إعدادات رؤية أ');
    const b = await h.createOrg(`sg-settings-vis-b-${Date.now()}`, 'منظمة إعدادات رؤية ب');

    const rowA = await h.runAs({ organizationId: a.id }, () =>
      h.prisma.organizationSettings.create({
        data: { organizationId: a.id },
        select: { id: true },
      }),
    );

    let fromB: Awaited<ReturnType<typeof h.prisma.organizationSettings.findFirst>>;
    await h.runAs({ organizationId: b.id }, async () => {
      fromB = await h.prisma.organizationSettings.findFirst({ where: { id: rowA.id } });
    });

    expect(fromB!).toBeNull();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 5. RLS hides BrandingConfig rows at SQL level when GUC differs
  // ──────────────────────────────────────────────────────────────────────────

  it('RLS hides BrandingConfig rows at SQL level when GUC differs', async () => {
    const a = await h.createOrg(`sg-rls-a-${Date.now()}`, 'منظمة RLS علامة أ');
    const b = await h.createOrg(`sg-rls-b-${Date.now()}`, 'منظمة RLS علامة ب');

    await h.prisma.$executeRawUnsafe(
      `INSERT INTO "BrandingConfig" (id, "organizationId", "organizationNameAr", "activeWebsiteTheme", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, 'RLS علامة أ', 'SAWAA', now(), now())`,
      a.id,
    );

    const tmpRole = `rls_probe_sg_${Date.now()}`;
    try {
      await h.prisma.$executeRawUnsafe(`CREATE ROLE ${tmpRole}`);
      await h.prisma.$executeRawUnsafe(`GRANT SELECT ON "BrandingConfig" TO ${tmpRole}`);

      const rows = await h.prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`SET LOCAL app.current_org_id = '${b.id}'`);
        await tx.$executeRawUnsafe(`SET LOCAL ROLE ${tmpRole}`);
        return tx.$queryRaw<Array<{ cnt: bigint }>>`
          SELECT COUNT(*)::bigint AS cnt FROM "BrandingConfig" WHERE "organizationId" = ${a.id}
        `;
      });

      expect(Number(rows[0].cnt)).toBe(0);
    } finally {
      await h.prisma.$executeRawUnsafe(`REVOKE ALL ON "BrandingConfig" FROM ${tmpRole}`).catch(() => {});
      await h.prisma.$executeRawUnsafe(`DROP ROLE IF EXISTS ${tmpRole}`).catch(() => {});
    }
  });
});
