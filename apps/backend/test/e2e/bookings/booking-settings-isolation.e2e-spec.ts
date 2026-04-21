import { bootHarness, IsolationHarness } from '../../tenant-isolation/isolation-harness';

describe('SaaS-02d — BookingSettings isolation', () => {
  let h: IsolationHarness;

  beforeAll(async () => {
    h = await bootHarness();
  });

  afterAll(async () => {
    if (h) await h.close();
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. BookingSettings — cross-org visibility
  // ─────────────────────────────────────────────────────────────────────────────

  it('BookingSettings created in org B is invisible from org A', async () => {
    const a = await h.createOrg(`bks-iso-vis-a-${Date.now()}`, 'منظمة إعدادات حجز أ');
    const b = await h.createOrg(`bks-iso-vis-b-${Date.now()}`, 'منظمة إعدادات حجز ب');

    const settingsB = await h.runAs({ organizationId: b.id }, () =>
      h.prisma.bookingSettings.create({
        data: {
          organizationId: b.id,
          branchId: `branch-b-${Date.now()}`,
          bufferMinutes: 15,
        },
        select: { id: true },
      }),
    );

    let fromA: Awaited<ReturnType<typeof h.prisma.bookingSettings.findFirst>>;
    await h.runAs({ organizationId: a.id }, async () => {
      fromA = await h.prisma.bookingSettings.findFirst({ where: { id: settingsB.id } });
    });

    expect(fromA!).toBeNull();
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. BookingSettings — two orgs can each have a global row (branchId: null)
  // ─────────────────────────────────────────────────────────────────────────────

  it('org A and org B can each have a global BookingSettings row with separate values', async () => {
    const ts = Date.now();
    const a = await h.createOrg(`bks-iso-global-a-${ts}`, 'منظمة إعدادات عامة أ');
    const b = await h.createOrg(`bks-iso-global-b-${ts}`, 'منظمة إعدادات عامة ب');

    const sA = await h.runAs({ organizationId: a.id }, () =>
      h.prisma.bookingSettings.create({
        data: {
          organizationId: a.id,
          branchId: null,
          bufferMinutes: 10,
          maxAdvanceBookingDays: 30,
        },
        select: { id: true, organizationId: true, bufferMinutes: true, maxAdvanceBookingDays: true },
      }),
    );

    const sB = await h.runAs({ organizationId: b.id }, () =>
      h.prisma.bookingSettings.create({
        data: {
          organizationId: b.id,
          branchId: null,
          bufferMinutes: 20,
          maxAdvanceBookingDays: 60,
        },
        select: { id: true, organizationId: true, bufferMinutes: true, maxAdvanceBookingDays: true },
      }),
    );

    // Each org gets its own distinct row
    expect(sA.id).not.toBe(sB.id);
    expect(sA.organizationId).toBe(a.id);
    expect(sB.organizationId).toBe(b.id);

    // Values are independent
    expect(sA.bufferMinutes).toBe(10);
    expect(sB.bufferMinutes).toBe(20);
    expect(sA.maxAdvanceBookingDays).toBe(30);
    expect(sB.maxAdvanceBookingDays).toBe(60);

    // Org A cannot see org B's global settings row
    let fromA: Awaited<ReturnType<typeof h.prisma.bookingSettings.findFirst>>;
    await h.runAs({ organizationId: a.id }, async () => {
      fromA = await h.prisma.bookingSettings.findFirst({ where: { id: sB.id } });
    });
    expect(fromA!).toBeNull();

    // Org B cannot see org A's global settings row
    let fromB: Awaited<ReturnType<typeof h.prisma.bookingSettings.findFirst>>;
    await h.runAs({ organizationId: b.id }, async () => {
      fromB = await h.prisma.bookingSettings.findFirst({ where: { id: sA.id } });
    });
    expect(fromB!).toBeNull();
  });
});
