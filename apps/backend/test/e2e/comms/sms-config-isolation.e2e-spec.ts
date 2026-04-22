import { bootHarness, IsolationHarness } from '../../tenant-isolation/isolation-harness';

/**
 * SaaS-02g-sms §11 — OrganizationSmsConfig singleton isolation
 *
 * 1. Each org gets its own OrganizationSmsConfig row (lazy-created on upsert-on-read).
 * 2. Updating Org A's config does not mutate Org B's.
 */
describe('SaaS-02g-sms — OrganizationSmsConfig isolation', () => {
  let h: IsolationHarness;

  beforeAll(async () => {
    h = await bootHarness();
  });

  afterAll(async () => {
    if (h) await h.close();
  });

  it('each org gets its own OrganizationSmsConfig row', async () => {
    const ts = Date.now();
    const a = await h.createOrg(`sms-cfg-a-${ts}`, 'منظمة رسائل أ');
    const b = await h.createOrg(`sms-cfg-b-${ts}`, 'منظمة رسائل ب');

    const cfgA = await h.runAs({ organizationId: a.id }, () =>
      h.prisma.organizationSmsConfig.upsert({
        where: { organizationId: a.id },
        update: {},
        create: { organizationId: a.id, provider: 'UNIFONIC', senderId: 'BrandA' },
      }),
    );

    const cfgB = await h.runAs({ organizationId: b.id }, () =>
      h.prisma.organizationSmsConfig.upsert({
        where: { organizationId: b.id },
        update: {},
        create: { organizationId: b.id, provider: 'TAQNYAT', senderId: 'BrandB' },
      }),
    );

    expect(cfgA.id).not.toBe(cfgB.id);
    expect(cfgA.organizationId).toBe(a.id);
    expect(cfgB.organizationId).toBe(b.id);
    expect(cfgA.provider).toBe('UNIFONIC');
    expect(cfgB.provider).toBe('TAQNYAT');
  });

  it("updating org A's SMS config does not mutate org B's", async () => {
    const ts = Date.now();
    const a = await h.createOrg(`sms-upd-a-${ts}`, 'منظمة تحديث أ');
    const b = await h.createOrg(`sms-upd-b-${ts}`, 'منظمة تحديث ب');

    await h.runAs({ organizationId: a.id }, () =>
      h.prisma.organizationSmsConfig.upsert({
        where: { organizationId: a.id },
        update: {},
        create: { organizationId: a.id, provider: 'UNIFONIC', senderId: 'orig-A' },
      }),
    );
    await h.runAs({ organizationId: b.id }, () =>
      h.prisma.organizationSmsConfig.upsert({
        where: { organizationId: b.id },
        update: {},
        create: { organizationId: b.id, provider: 'TAQNYAT', senderId: 'orig-B' },
      }),
    );

    await h.runAs({ organizationId: a.id }, () =>
      h.prisma.organizationSmsConfig.update({
        where: { organizationId: a.id },
        data: { senderId: 'A-updated' },
      }),
    );

    let fromB: { senderId: string | null; provider: string } | null = null;
    await h.runAs({ organizationId: b.id }, async () => {
      fromB = await h.prisma.organizationSmsConfig.findFirst({
        where: { organizationId: b.id },
        select: { senderId: true, provider: true },
      });
    });
    expect(fromB!.senderId).toBe('orig-B');
    expect(fromB!.provider).toBe('TAQNYAT');
  });

  it('org A cannot see org B SmsDelivery rows', async () => {
    const ts = Date.now();
    const a = await h.createOrg(`sms-del-a-${ts}`, 'منظمة إرسال أ');
    const b = await h.createOrg(`sms-del-b-${ts}`, 'منظمة إرسال ب');

    const tagA = `from-A-${ts}`;
    const tagB = `from-B-${ts}`;

    await h.runAs({ organizationId: a.id }, () =>
      h.prisma.smsDelivery.create({
        data: {
          organizationId: a.id,
          provider: 'UNIFONIC',
          toPhone: '+9665' + ts,
          body: tagA,
          bodyHash: 'hash-a',
          status: 'SENT',
        },
      }),
    );
    await h.runAs({ organizationId: b.id }, () =>
      h.prisma.smsDelivery.create({
        data: {
          organizationId: b.id,
          provider: 'TAQNYAT',
          toPhone: '+9666' + ts,
          body: tagB,
          bodyHash: 'hash-b',
          status: 'SENT',
        },
      }),
    );

    // From org A's CLS context, count rows tagged as B — must return 0.
    let aSeesBCount = -1;
    await h.runAs({ organizationId: a.id }, async () => {
      aSeesBCount = await h.prisma.smsDelivery.count({ where: { body: tagB } });
    });
    expect(aSeesBCount).toBe(0);

    // From org B's CLS context, count rows tagged as A — must return 0.
    let bSeesACount = -1;
    await h.runAs({ organizationId: b.id }, async () => {
      bSeesACount = await h.prisma.smsDelivery.count({ where: { body: tagA } });
    });
    expect(bSeesACount).toBe(0);

    // Sanity — each org sees its own row.
    let aOwnCount = -1;
    await h.runAs({ organizationId: a.id }, async () => {
      aOwnCount = await h.prisma.smsDelivery.count({ where: { body: tagA } });
    });
    expect(aOwnCount).toBe(1);
  });
});
