import { bootHarness, IsolationHarness } from '../../tenant-isolation/isolation-harness';

/**
 * SaaS-02f §9.1 — Notification cross-tenant isolation
 *
 * 1. Org A creates a Notification. Org B cannot see it via findMany / findFirst.
 * 2. updateMany under Org B's context does not mutate Org A's row.
 * 3. count respects tenant boundary.
 */
describe('SaaS-02f — notification isolation', () => {
  let h: IsolationHarness;

  beforeAll(async () => {
    h = await bootHarness();
  });

  afterAll(async () => {
    if (h) await h.close();
  });

  it('notification created in org A is invisible from org B', async () => {
    const ts = Date.now();
    const a = await h.createOrg(`notif-iso-a-${ts}`, 'منظمة إشعار أ');
    const b = await h.createOrg(`notif-iso-b-${ts}`, 'منظمة إشعار ب');

    const notif = await h.runAs({ organizationId: a.id }, () =>
      h.prisma.notification.create({
        data: {
          organizationId: a.id,
          recipientId: `client-${ts}`,
          recipientType: 'CLIENT',
          type: 'GENERAL',
          title: 'Only in A',
          body: 'body',
        },
        select: { id: true },
      }),
    );

    let fromB: Awaited<ReturnType<typeof h.prisma.notification.findFirst>>;
    await h.runAs({ organizationId: b.id }, async () => {
      fromB = await h.prisma.notification.findFirst({ where: { id: notif.id } });
    });
    expect(fromB!).toBeNull();
  });

  it('updateMany in org B cannot flip org A notification to isRead=true', async () => {
    const ts = Date.now();
    const a = await h.createOrg(`notif-upd-a-${ts}`, 'منظمة تحديث إشعار أ');
    const b = await h.createOrg(`notif-upd-b-${ts}`, 'منظمة تحديث إشعار ب');

    const notif = await h.runAs({ organizationId: a.id }, () =>
      h.prisma.notification.create({
        data: {
          organizationId: a.id,
          recipientId: `client-${ts}`,
          recipientType: 'CLIENT',
          type: 'GENERAL',
          title: 'untouched',
          body: 'x',
        },
        select: { id: true },
      }),
    );

    await h.runAs({ organizationId: b.id }, async () => {
      await h.prisma.notification.updateMany({
        where: { id: notif.id },
        data: { isRead: true },
      });
    });

    // Read back under Org A and assert it's still unread.
    let reread: { isRead: boolean } | null = null;
    await h.runAs({ organizationId: a.id }, async () => {
      reread = await h.prisma.notification.findFirst({
        where: { id: notif.id },
        select: { isRead: true },
      });
    });
    expect(reread!.isRead).toBe(false);
  });

  it('count in org B excludes org A notifications', async () => {
    const ts = Date.now();
    const a = await h.createOrg(`notif-cnt-a-${ts}`, 'منظمة عدّ إشعار أ');
    const b = await h.createOrg(`notif-cnt-b-${ts}`, 'منظمة عدّ إشعار ب');

    await h.runAs({ organizationId: a.id }, () =>
      h.prisma.notification.create({
        data: {
          organizationId: a.id,
          recipientId: `client-${ts}-a`,
          recipientType: 'CLIENT',
          type: 'GENERAL',
          title: 'A-1',
          body: 'x',
        },
      }),
    );
    await h.runAs({ organizationId: a.id }, () =>
      h.prisma.notification.create({
        data: {
          organizationId: a.id,
          recipientId: `client-${ts}-a2`,
          recipientType: 'CLIENT',
          type: 'GENERAL',
          title: 'A-2',
          body: 'x',
        },
      }),
    );

    let countFromB = -1;
    await h.runAs({ organizationId: b.id }, async () => {
      countFromB = await h.prisma.notification.count({});
    });
    expect(countFromB).toBe(0);
  });
});
