import { bootHarness, IsolationHarness } from '../../tenant-isolation/isolation-harness';

/**
 * SaaS-02g §11.5 — ProblemReport cross-tenant isolation.
 */
describe('SaaS-02g — problem-report isolation', () => {
  let h: IsolationHarness;

  beforeAll(async () => {
    h = await bootHarness();
  });

  afterAll(async () => {
    if (h) await h.close();
  });

  it('org B cannot list problem reports from org A', async () => {
    const ts = Date.now();
    const a = await h.createOrg(`pr-iso-a-${ts}`, 'بلاغات أ');
    const b = await h.createOrg(`pr-iso-b-${ts}`, 'بلاغات ب');

    await h.runAs({ organizationId: a.id }, () =>
      h.prisma.problemReport.create({
        data: {
          organizationId: a.id,
          reporterId: 'user-A',
          type: 'BUG',
          title: 'only-in-A',
          description: 'secret',
        },
      }),
    );

    let fromBCount = -1;
    await h.runAs({ organizationId: b.id }, async () => {
      fromBCount = await h.prisma.problemReport.count({});
    });
    expect(fromBCount).toBe(0);
  });

  it("org B cannot mutate org A's problem report by id", async () => {
    const ts = Date.now();
    const a = await h.createOrg(`pr-upd-a-${ts}`, 'تحديث بلاغ أ');
    const b = await h.createOrg(`pr-upd-b-${ts}`, 'تحديث بلاغ ب');

    const report = await h.runAs({ organizationId: a.id }, () =>
      h.prisma.problemReport.create({
        data: {
          organizationId: a.id,
          reporterId: 'user-A',
          type: 'BUG',
          title: 't',
          description: 'd',
        },
        select: { id: true },
      }),
    );

    await h.runAs({ organizationId: b.id }, async () => {
      const res = await h.prisma.problemReport.updateMany({
        where: { id: report.id },
        data: { status: 'RESOLVED' },
      });
      expect(res.count).toBe(0);
    });

    const after = await h.runAs({ organizationId: a.id }, () =>
      h.prisma.problemReport.findUnique({ where: { id: report.id }, select: { status: true } }),
    );
    expect(after!.status).toBe('OPEN');
  });
});
