import SuperTest from 'supertest';
import { createTestApp, closeTestApp } from '../../setup/app.setup';
import { testPrisma, cleanTables } from '../../setup/db.setup';
import { seedUser, seedOrganization } from '../../setup/seed.helper';

const ORG_A_ID = '00000000-0000-0000-0000-000000000001';
const ORG_B_ID = '00000000-0000-0000-0000-000000000002';

async function createOrgUser(
  prisma: typeof testPrisma,
  orgId: string,
  email: string,
  role = 'ADMIN',
) {
  const passwordHash = 'Test@1234';
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      name: email.split('@')[0],
      role: role as never,
    },
  });
  await prisma.membership.create({
    data: {
      userId: user.id,
      organizationId: orgId,
      role: role as never,
      isActive: true,
      acceptedAt: new Date(),
    },
  });
  return { user, password: 'Test@1234' };
}

describe('Members — Tenant Isolation (e2e)', () => {
  let req: SuperTest.Agent;
  let orgAUser: { user: { id: string }; password: string };
  let orgBUser: { user: { id: string }; password: string };

  beforeAll(async () => {
    ({ request: req } = await createTestApp());
    await cleanTables(['Invitation', 'Membership', 'User', 'Organization']);

    // Seed two separate orgs with users
    await seedOrganization(testPrisma as never, { id: ORG_A_ID, slug: 'org-a', nameAr: 'Org A' });
    await seedOrganization(testPrisma as never, { id: ORG_B_ID, slug: 'org-b', nameAr: 'Org B' });

    orgAUser = await createOrgUser(testPrisma as never, ORG_A_ID, 'usera@org-a.com', 'ADMIN');
    orgBUser = await createOrgUser(testPrisma as never, ORG_B_ID, 'userb@org-b.com', 'ADMIN');
  });

  afterAll(async () => {
    await cleanTables(['Invitation', 'Membership', 'User', 'Organization']);
    await closeTestApp();
  });

  async function loginAs(email: string, password: string) {
    const res = await req.post('/auth/login').send({ email, password });
    const token = res.body.accessToken as string;
    return token;
  }

  it('GET /dashboard/identity/members — Org A sees only its own members', async () => {
    const token = await loginAs(orgAUser.user.email, orgAUser.password);

    const res = await req
      .get('/dashboard/identity/members')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const memberUserIds = (res.body.items as { userId: string }[]).map((m) => m.userId);
    expect(memberUserIds).toContain(orgAUser.user.id);
    expect(memberUserIds).not.toContain(orgBUser.user.id);
  });

  it('GET /dashboard/identity/members — Org B sees only its own members', async () => {
    const token = await loginAs(orgBUser.user.email, orgBUser.password);

    const res = await req
      .get('/dashboard/identity/members')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const memberUserIds = (res.body.items as { userId: string }[]).map((m) => m.userId);
    expect(memberUserIds).toContain(orgBUser.user.id);
    expect(memberUserIds).not.toContain(orgAUser.user.id);
  });

  it('POST /dashboard/identity/members/invite — Org A cannot invite user already in Org B', async () => {
    const token = await loginAs(orgAUser.user.email, orgAUser.password);

    const res = await req
      .post('/dashboard/identity/members/invite')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: orgBUser.user.email, role: 'ADMIN' });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/ALREADY_MEMBER/i);
  });

  it('GET /dashboard/identity/members/invitations — Org A cannot see Org B invitations', async () => {
    const token = await loginAs(orgAUser.user.email, orgAUser.password);

    const res = await req
      .get('/dashboard/identity/members/invitations')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const emails = (res.body.items as { email: string }[]).map((i) => i.email);
    expect(emails).not.toContain(orgBUser.user.email);
  });
});