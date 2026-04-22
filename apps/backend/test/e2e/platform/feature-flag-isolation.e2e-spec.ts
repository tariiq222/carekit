import { bootHarness, IsolationHarness } from '../../tenant-isolation/isolation-harness';

/**
 * SaaS-02g §11.4 — FeatureFlag cross-tenant isolation + composite key unique.
 *
 * Same `key` can exist in two orgs with different `enabled` values; each org
 * reads its own value.
 */
describe('SaaS-02g — feature-flag isolation', () => {
  let h: IsolationHarness;

  beforeAll(async () => {
    h = await bootHarness();
  });

  afterAll(async () => {
    if (h) await h.close();
  });

  it('same flag key lives independently per org', async () => {
    const ts = Date.now();
    const a = await h.createOrg(`ff-iso-a-${ts}`, 'أعلام أ');
    const b = await h.createOrg(`ff-iso-b-${ts}`, 'أعلام ب');
    const key = `beta.new-checkout-${ts}`;

    const flagA = await h.runAs({ organizationId: a.id }, () =>
      h.prisma.featureFlag.create({
        data: {
          organizationId: a.id,
          key,
          enabled: true,
          nameAr: 'إعادة هيكلة الدفع',
          nameEn: 'New checkout',
        },
      }),
    );
    const flagB = await h.runAs({ organizationId: b.id }, () =>
      h.prisma.featureFlag.create({
        data: {
          organizationId: b.id,
          key, // same key as A — allowed by composite unique
          enabled: false,
          nameAr: 'إعادة هيكلة الدفع',
          nameEn: 'New checkout',
        },
      }),
    );

    expect(flagA.id).not.toBe(flagB.id);
    expect(flagA.enabled).toBe(true);
    expect(flagB.enabled).toBe(false);

    let readA: { enabled: boolean } | null = null;
    let readB: { enabled: boolean } | null = null;
    await h.runAs({ organizationId: a.id }, async () => {
      readA = await h.prisma.featureFlag.findFirst({ where: { key }, select: { enabled: true } });
    });
    await h.runAs({ organizationId: b.id }, async () => {
      readB = await h.prisma.featureFlag.findFirst({ where: { key }, select: { enabled: true } });
    });
    expect(readA!.enabled).toBe(true);
    expect(readB!.enabled).toBe(false);
  });

  it('org B cannot update org A feature flag even when it knows the id', async () => {
    const ts = Date.now();
    const a = await h.createOrg(`ff-upd-a-${ts}`, 'أعلام تحديث أ');
    const b = await h.createOrg(`ff-upd-b-${ts}`, 'أعلام تحديث ب');

    const flag = await h.runAs({ organizationId: a.id }, () =>
      h.prisma.featureFlag.create({
        data: {
          organizationId: a.id,
          key: `protected-${ts}`,
          enabled: true,
          nameAr: 'محمي',
          nameEn: 'Protected',
        },
      }),
    );

    await h.runAs({ organizationId: b.id }, async () => {
      const res = await h.prisma.featureFlag.updateMany({
        where: { id: flag.id },
        data: { enabled: false },
      });
      expect(res.count).toBe(0);
    });

    const after = await h.runAs({ organizationId: a.id }, () =>
      h.prisma.featureFlag.findUnique({
        where: { organizationId_key: { organizationId: a.id, key: flag.key } },
        select: { enabled: true },
      }),
    );
    expect(after!.enabled).toBe(true);
  });
});
