import { bootHarness, IsolationHarness } from '../../tenant-isolation/isolation-harness';

/**
 * SaaS-02g §11.6 — SiteSetting cross-tenant isolation.
 *
 * SiteSetting is key-value per org (composite PK (organizationId, key)). Proves:
 *   1. Same `key` can exist in two orgs with different values.
 *   2. Updating org A does not affect org B.
 */
describe('SaaS-02g — site-setting isolation', () => {
  let h: IsolationHarness;

  beforeAll(async () => {
    h = await bootHarness();
  });

  afterAll(async () => {
    if (h) await h.close();
  });

  it('same key holds independent values per org', async () => {
    const ts = Date.now();
    const a = await h.createOrg(`ss-iso-a-${ts}`, 'إعدادات موقع أ');
    const b = await h.createOrg(`ss-iso-b-${ts}`, 'إعدادات موقع ب');
    const key = `home.hero.title.ar-${ts}`;

    await h.runAs({ organizationId: a.id }, () =>
      h.prisma.siteSetting.create({
        data: { organizationId: a.id, key, valueText: 'عنوان-أ' },
      }),
    );
    await h.runAs({ organizationId: b.id }, () =>
      h.prisma.siteSetting.create({
        data: { organizationId: b.id, key, valueText: 'عنوان-ب' },
      }),
    );

    let readA: { valueText: string | null } | null = null;
    let readB: { valueText: string | null } | null = null;
    await h.runAs({ organizationId: a.id }, async () => {
      readA = await h.prisma.siteSetting.findUnique({
        where: { organizationId_key: { organizationId: a.id, key } },
        select: { valueText: true },
      });
    });
    await h.runAs({ organizationId: b.id }, async () => {
      readB = await h.prisma.siteSetting.findUnique({
        where: { organizationId_key: { organizationId: b.id, key } },
        select: { valueText: true },
      });
    });
    expect(readA!.valueText).toBe('عنوان-أ');
    expect(readB!.valueText).toBe('عنوان-ب');
  });

  it("updating org A setting does not mutate org B's same-key setting", async () => {
    const ts = Date.now();
    const a = await h.createOrg(`ss-upd-a-${ts}`, 'إعداد تحديث أ');
    const b = await h.createOrg(`ss-upd-b-${ts}`, 'إعداد تحديث ب');
    const key = `home.cta.ctaPrimary-${ts}`;

    await h.runAs({ organizationId: a.id }, () =>
      h.prisma.siteSetting.create({ data: { organizationId: a.id, key, valueText: 'A-v1' } }),
    );
    await h.runAs({ organizationId: b.id }, () =>
      h.prisma.siteSetting.create({ data: { organizationId: b.id, key, valueText: 'B-v1' } }),
    );

    await h.runAs({ organizationId: a.id }, () =>
      h.prisma.siteSetting.update({
        where: { organizationId_key: { organizationId: a.id, key } },
        data: { valueText: 'A-v2' },
      }),
    );

    const after = await h.runAs({ organizationId: b.id }, () =>
      h.prisma.siteSetting.findUnique({
        where: { organizationId_key: { organizationId: b.id, key } },
        select: { valueText: true },
      }),
    );
    expect(after!.valueText).toBe('B-v1');
  });
});
