import { bootHarness, IsolationHarness } from '../../tenant-isolation/isolation-harness';

/**
 * SaaS-02g §11.3 — ActivityLog cross-tenant isolation.
 *
 * ActivityLog is written from MANY call sites (every authenticated mutation).
 * This test proves that listing activity from one org never reveals another.
 */
describe('SaaS-02g — activity-log isolation', () => {
  let h: IsolationHarness;

  beforeAll(async () => {
    h = await bootHarness();
  });

  afterAll(async () => {
    if (h) await h.close();
  });

  it('each org sees only its own activity entries', async () => {
    const ts = Date.now();
    const a = await h.createOrg(`al-iso-a-${ts}`, 'سجل أ');
    const b = await h.createOrg(`al-iso-b-${ts}`, 'سجل ب');

    await h.runAs({ organizationId: a.id }, () =>
      h.prisma.activityLog.create({
        data: {
          organizationId: a.id,
          action: 'CREATE',
          entity: 'Booking',
          entityId: 'booking-A',
          description: 'org-A created a booking',
        },
      }),
    );
    await h.runAs({ organizationId: b.id }, () =>
      h.prisma.activityLog.create({
        data: {
          organizationId: b.id,
          action: 'UPDATE',
          entity: 'Booking',
          entityId: 'booking-B',
          description: 'org-B updated a booking',
        },
      }),
    );

    let fromA: Array<{ entityId: string | null; description: string }> = [];
    let fromB: Array<{ entityId: string | null; description: string }> = [];
    await h.runAs({ organizationId: a.id }, async () => {
      fromA = await h.prisma.activityLog.findMany({
        select: { entityId: true, description: true },
      });
    });
    await h.runAs({ organizationId: b.id }, async () => {
      fromB = await h.prisma.activityLog.findMany({
        select: { entityId: true, description: true },
      });
    });

    expect(fromA.some((r) => r.entityId === 'booking-A')).toBe(true);
    expect(fromA.some((r) => r.entityId === 'booking-B')).toBe(false);
    expect(fromB.some((r) => r.entityId === 'booking-B')).toBe(true);
    expect(fromB.some((r) => r.entityId === 'booking-A')).toBe(false);
  });
});
