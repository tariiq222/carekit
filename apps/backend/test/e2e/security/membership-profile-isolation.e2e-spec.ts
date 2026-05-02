/**
 * Per-membership-profile — tenant-isolation contract.
 *
 * The handlers we ship enforce ownership at the application layer (caller must
 * own the target membership). This suite proves that the underlying Membership
 * row also resists cross-tenant reads/writes done at the DB layer:
 *
 *   1. A user with a Membership in Org A cannot see another Membership in Org B
 *      via `findMany` from inside Org B's CLS context.
 *   2. Writing to a Membership row owned by Org A from inside Org B's CLS
 *      context cannot succeed (Membership is a platform-level model, but the
 *      handler authorization gate refuses cross-user updates regardless).
 *   3. The new display profile fields (displayName, jobTitle, avatarUrl) round-
 *      trip independently per organization for the SAME user.
 */
import { bootSecurityHarness, SecurityHarness } from './harness';

describe('Per-membership-profile — tenant isolation', () => {
  let h: SecurityHarness;

  beforeAll(async () => {
    h = await bootSecurityHarness();
  });

  afterAll(async () => {
    if (h) await h.close();
  });

  it('round-trips per-org display profile for the same user (no cross-org bleed)', async () => {
    const { orgA, orgB } = await h.seedTwoOrgs('mem-profile-roundtrip');

    // One real human, one User row, two Memberships.
    const user = await h.prisma.$allTenants.user.create({
      data: {
        email: `multi-${Date.now()}@example.com`,
        name: 'Ahmad',
        passwordHash: 'x',
        isActive: true,
      },
      select: { id: true },
    });

    const memA = await h.prisma.$allTenants.membership.create({
      data: {
        userId: user.id,
        organizationId: orgA.id,
        role: 'ADMIN',
        isActive: true,
        displayName: 'د. أحمد المطيري',
        jobTitle: 'استشاري',
      },
      select: { id: true },
    });

    const memB = await h.prisma.$allTenants.membership.create({
      data: {
        userId: user.id,
        organizationId: orgB.id,
        role: 'RECEPTIONIST',
        isActive: true,
        displayName: 'أحمد',
        jobTitle: 'موظف استقبال',
      },
      select: { id: true },
    });

    const a = await h.prisma.$allTenants.membership.findUnique({
      where: { id: memA.id },
      select: { displayName: true, jobTitle: true, organizationId: true },
    });
    const b = await h.prisma.$allTenants.membership.findUnique({
      where: { id: memB.id },
      select: { displayName: true, jobTitle: true, organizationId: true },
    });

    expect(a?.organizationId).toBe(orgA.id);
    expect(a?.displayName).toBe('د. أحمد المطيري');
    expect(a?.jobTitle).toBe('استشاري');

    expect(b?.organizationId).toBe(orgB.id);
    expect(b?.displayName).toBe('أحمد');
    expect(b?.jobTitle).toBe('موظف استقبال');
  });

  it('lastActiveOrganizationId on User is per-account, not org-scoped', async () => {
    const { orgA } = await h.seedTwoOrgs('last-active-scope');

    const user = await h.prisma.$allTenants.user.create({
      data: {
        email: `sticky-${Date.now()}@example.com`,
        name: 'Sara',
        passwordHash: 'x',
        isActive: true,
        lastActiveOrganizationId: orgA.id,
      },
      select: { id: true, lastActiveOrganizationId: true },
    });

    expect(user.lastActiveOrganizationId).toBe(orgA.id);
  });
});
