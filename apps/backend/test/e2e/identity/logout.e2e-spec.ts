import SuperTest from 'supertest';
import { createTestApp, closeTestApp } from '../../setup/app.setup';
import { testPrisma, cleanTables } from '../../setup/db.setup';
import { seedUser } from '../../setup/seed.helper';describe('POST /auth/logout (e2e)', () => {
  let req: SuperTest.Agent;
  let refreshToken: string;

  beforeAll(async () => {
    ({ request: req } = await createTestApp());
    await cleanTables(['RefreshToken', 'User']);
    await seedUser(testPrisma as any, {
      email: 'logout@clinic.com',
      password: 'Pass@1234',
      role: 'ADMIN',
    });

    const res = await req
      .post('/auth/login')
      .send({ email: 'logout@clinic.com', password: 'Pass@1234' });
    refreshToken = res.body.refreshToken;
  });

  afterAll(async () => {
    await cleanTables(['RefreshToken', 'User']);
    await closeTestApp();
  });

  it('✅ logout يحذف الـ refresh token من DB', async () => {
    const before = await (testPrisma as any).refreshToken.count({ where: { } });
    expect(before).toBeGreaterThan(0);

    const res = await req
      .post('/auth/logout')
      .send({ refreshToken });

    expect(res.status).toBe(200);

    const after = await (testPrisma as any).refreshToken.count({ where: { revokedAt: null } });
    expect(after).toBe(0);
  });

  it('❌ token غير صالح → 401', async () => {
    const res = await req
      .post('/auth/logout')
      .send({ refreshToken: 'invalid.token' });

    expect(res.status).toBe(401);
  });
});