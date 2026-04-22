import { bootHarness, IsolationHarness } from '../../tenant-isolation/isolation-harness';

/**
 * SaaS-02f §9.4 — ContactMessage cross-tenant isolation
 */
describe('SaaS-02f — contact-message isolation', () => {
  let h: IsolationHarness;

  beforeAll(async () => {
    h = await bootHarness();
  });

  afterAll(async () => {
    if (h) await h.close();
  });

  it('contact messages are scoped per org — org B cannot list org A submissions', async () => {
    const ts = Date.now();
    const a = await h.createOrg(`cm-iso-a-${ts}`, 'منظمة اتصال أ');
    const b = await h.createOrg(`cm-iso-b-${ts}`, 'منظمة اتصال ب');

    await h.runAs({ organizationId: a.id }, () =>
      h.prisma.contactMessage.create({
        data: {
          organizationId: a.id,
          name: 'visitor-A',
          email: 'a@example.com',
          body: 'only in A',
        },
      }),
    );

    let fromBCount = -1;
    await h.runAs({ organizationId: b.id }, async () => {
      fromBCount = await h.prisma.contactMessage.count({});
    });
    expect(fromBCount).toBe(0);
  });

  it("org B cannot update status of org A's contact message by id", async () => {
    const ts = Date.now();
    const a = await h.createOrg(`cm-upd-a-${ts}`, 'منظمة تحديث اتصال أ');
    const b = await h.createOrg(`cm-upd-b-${ts}`, 'منظمة تحديث اتصال ب');

    const msg = await h.runAs({ organizationId: a.id }, () =>
      h.prisma.contactMessage.create({
        data: {
          organizationId: a.id,
          name: 'v',
          email: 'v@example.com',
          body: 'x',
        },
        select: { id: true },
      }),
    );

    await h.runAs({ organizationId: b.id }, async () => {
      await h.prisma.contactMessage.updateMany({
        where: { id: msg.id },
        data: { status: 'ARCHIVED' },
      });
    });

    let reread: { status: string } | null = null;
    await h.runAs({ organizationId: a.id }, async () => {
      reread = await h.prisma.contactMessage.findFirst({
        where: { id: msg.id },
        select: { status: true },
      });
    });
    expect(reread!.status).toBe('NEW');
  });
});
