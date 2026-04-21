import { bootHarness, IsolationHarness } from './isolation-harness';
import { DEFAULT_ORGANIZATION_ID } from '../../src/common/tenant';

describe('SaaS-01 — foundation isolation', () => {
  let h: IsolationHarness;

  beforeAll(async () => {
    h = await bootHarness();
  });

  afterAll(async () => {
    if (h) await h.close();
  });

  it('default organization row exists with well-known UUID', async () => {
    const row = await h.prisma.organization.findUnique({
      where: { id: DEFAULT_ORGANIZATION_ID },
    });
    expect(row).not.toBeNull();
    expect(row?.slug).toBe('default');
  });

  it('every existing staff user has at least one active membership', async () => {
    // CLIENT users are excluded from backfill by design (see
    // 20260421112140_saas01_backfill_memberships/migration.sql) — the
    // invariant applies to clinic-staff users only.
    const users = await h.prisma.user.findMany({
      where: { role: { not: 'CLIENT' } },
      select: { id: true },
    });
    if (users.length === 0) return; // empty db — nothing to assert
    const memberships = await h.prisma.membership.findMany({
      where: { userId: { in: users.map((u) => u.id) }, isActive: true },
      select: { userId: true },
    });
    const withMembership = new Set(memberships.map((m) => m.userId));
    const missing = users.filter((u) => !withMembership.has(u.id));
    expect(missing).toEqual([]);
  });

  it('tenant context propagates through a CLS run', async () => {
    const a = await h.createOrg('iso-a', 'منظمة أ');
    await h.runAs({ organizationId: a.id }, async () => {
      expect(h.ctx.getOrganizationId()).toBe(a.id);
    });
    expect(h.ctx.getOrganizationId()).toBeUndefined();
  });

  it('parallel CLS runs do not leak context between tenants', async () => {
    const a = await h.createOrg('iso-par-a', 'منظمة متوازية أ');
    const b = await h.createOrg('iso-par-b', 'منظمة متوازية ب');

    const results = await Promise.all([
      h.runAs({ organizationId: a.id }, async () => {
        await new Promise((r) => setTimeout(r, 20));
        return h.ctx.getOrganizationId();
      }),
      h.runAs({ organizationId: b.id }, async () => {
        await new Promise((r) => setTimeout(r, 20));
        return h.ctx.getOrganizationId();
      }),
    ]);

    expect(results).toEqual([a.id, b.id]);
  });

  it('app_current_org_id() SQL helper returns NULL when GUC is empty', async () => {
    const [row] = await h.prisma.$queryRaw<Array<{ id: string | null }>>`
      SELECT app_current_org_id()::text AS id
    `;
    expect(row.id).toBeNull();
  });

  it('app_current_org_id() returns the set value when GUC is populated', async () => {
    const a = await h.createOrg('iso-rls', 'منظمة RLS');
    await h.prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.current_org_id = '${a.id}'`);
      const [row] = await tx.$queryRaw<Array<{ id: string | null }>>`
        SELECT app_current_org_id()::text AS id
      `;
      expect(row.id).toBe(a.id);
    });
  });
});
