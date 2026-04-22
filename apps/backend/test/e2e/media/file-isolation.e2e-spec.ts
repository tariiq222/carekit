import { bootHarness, IsolationHarness } from '../../tenant-isolation/isolation-harness';

/**
 * SaaS-02g §11.2 — File cross-tenant isolation + composite storageKey unique.
 *
 * 1. Same `storageKey` is allowed across orgs (composite unique = (orgId, storageKey)).
 * 2. Org A cannot list/read org B's files.
 */
describe('SaaS-02g — file isolation', () => {
  let h: IsolationHarness;

  beforeAll(async () => {
    h = await bootHarness();
  });

  afterAll(async () => {
    if (h) await h.close();
  });

  it('same storageKey can exist in two orgs (composite unique per org)', async () => {
    const ts = Date.now();
    const a = await h.createOrg(`file-iso-a-${ts}`, 'ملفات أ');
    const b = await h.createOrg(`file-iso-b-${ts}`, 'ملفات ب');
    const storageKey = `shared-key-${ts}.pdf`;

    const fileA = await h.runAs({ organizationId: a.id }, () =>
      h.prisma.file.create({
        data: {
          organizationId: a.id,
          bucket: 'carekit',
          storageKey,
          filename: 'a.pdf',
          mimetype: 'application/pdf',
          size: 100,
        },
      }),
    );
    const fileB = await h.runAs({ organizationId: b.id }, () =>
      h.prisma.file.create({
        data: {
          organizationId: b.id,
          bucket: 'carekit',
          storageKey, // same storageKey as A — must not collide
          filename: 'b.pdf',
          mimetype: 'application/pdf',
          size: 200,
        },
      }),
    );

    expect(fileA.id).not.toBe(fileB.id);
    expect(fileA.storageKey).toBe(fileB.storageKey);
    expect(fileA.organizationId).toBe(a.id);
    expect(fileB.organizationId).toBe(b.id);
  });

  it('org B cannot list org A files', async () => {
    const ts = Date.now();
    const a = await h.createOrg(`file-list-a-${ts}`, 'قائمة ملفات أ');
    const b = await h.createOrg(`file-list-b-${ts}`, 'قائمة ملفات ب');

    await h.runAs({ organizationId: a.id }, () =>
      h.prisma.file.create({
        data: {
          organizationId: a.id,
          bucket: 'carekit',
          storageKey: `a-only-${ts}`,
          filename: 'secret.pdf',
          mimetype: 'application/pdf',
          size: 1,
        },
      }),
    );

    let fromBCount = -1;
    await h.runAs({ organizationId: b.id }, async () => {
      fromBCount = await h.prisma.file.count({});
    });
    expect(fromBCount).toBe(0);
  });
});
