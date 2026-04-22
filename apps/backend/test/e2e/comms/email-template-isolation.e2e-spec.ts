import { bootHarness, IsolationHarness } from '../../tenant-isolation/isolation-harness';

/**
 * SaaS-02f §9.2 — EmailTemplate cross-tenant isolation
 *
 * 1. Same slug can exist in two orgs (composite unique on org+slug).
 * 2. findFirst({slug}) in Org A returns Org A's template; in Org B returns Org B's.
 * 3. Org B cannot read Org A's template by id.
 */
describe('SaaS-02f — email-template isolation', () => {
  let h: IsolationHarness;

  beforeAll(async () => {
    h = await bootHarness();
  });

  afterAll(async () => {
    if (h) await h.close();
  });

  it('same slug can be created by two orgs and each org sees only its own row', async () => {
    const ts = Date.now();
    const a = await h.createOrg(`tpl-iso-a-${ts}`, 'منظمة قالب أ');
    const b = await h.createOrg(`tpl-iso-b-${ts}`, 'منظمة قالب ب');
    const slug = `welcome-${ts}`;

    const tplA = await h.runAs({ organizationId: a.id }, () =>
      h.prisma.emailTemplate.create({
        data: {
          organizationId: a.id,
          slug,
          nameAr: 'ترحيب أ',
          subjectAr: 'مرحباً أ',
          htmlBody: '<p>A</p>',
        },
        select: { id: true, organizationId: true, slug: true },
      }),
    );

    const tplB = await h.runAs({ organizationId: b.id }, () =>
      h.prisma.emailTemplate.create({
        data: {
          organizationId: b.id,
          slug,
          nameAr: 'ترحيب ب',
          subjectAr: 'مرحباً ب',
          htmlBody: '<p>B</p>',
        },
        select: { id: true, organizationId: true, slug: true },
      }),
    );

    expect(tplA.id).not.toBe(tplB.id);

    let fromA: Awaited<ReturnType<typeof h.prisma.emailTemplate.findFirst>>;
    await h.runAs({ organizationId: a.id }, async () => {
      fromA = await h.prisma.emailTemplate.findFirst({ where: { slug } });
    });
    expect(fromA!.id).toBe(tplA.id);

    let fromB: Awaited<ReturnType<typeof h.prisma.emailTemplate.findFirst>>;
    await h.runAs({ organizationId: b.id }, async () => {
      fromB = await h.prisma.emailTemplate.findFirst({ where: { slug } });
    });
    expect(fromB!.id).toBe(tplB.id);
  });

  it("org B cannot read org A's email template by id", async () => {
    const ts = Date.now();
    const a = await h.createOrg(`tpl-xid-a-${ts}`, 'منظمة قالب عبور أ');
    const b = await h.createOrg(`tpl-xid-b-${ts}`, 'منظمة قالب عبور ب');

    const tplA = await h.runAs({ organizationId: a.id }, () =>
      h.prisma.emailTemplate.create({
        data: {
          organizationId: a.id,
          slug: `only-A-${ts}`,
          nameAr: 'خاص بـ أ',
          subjectAr: 'خاص',
          htmlBody: '<p></p>',
        },
        select: { id: true },
      }),
    );

    let fromB: Awaited<ReturnType<typeof h.prisma.emailTemplate.findFirst>>;
    await h.runAs({ organizationId: b.id }, async () => {
      fromB = await h.prisma.emailTemplate.findFirst({ where: { id: tplA.id } });
    });
    expect(fromB!).toBeNull();
  });
});
