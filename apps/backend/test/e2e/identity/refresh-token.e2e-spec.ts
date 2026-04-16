import SuperTest from 'supertest';
import { createTestApp, closeTestApp } from '../../setup/app.setup';
import { testPrisma, cleanTables } from '../../setup/db.setup';
import { seedUser } from '../../setup/seed.helper';describe('POST /auth/refresh (e2e)', () => {
  let req: SuperTest.Agent;
  let firstRefreshToken: string;

  beforeAll(async () => {
    ({ request: req } = await createTestApp());
    await cleanTables(['RefreshToken', 'User']);
    await seedUser(testPrisma as any, {
      email: 'user@clinic.com',
      password: 'Pass@1234',
    });

    const res = await req
      .post('/auth/login')
      .send({ email: 'user@clinic.com', password: 'Pass@1234' });
    firstRefreshToken = res.body.refreshToken;
  });

  afterAll(async () => {
    await cleanTables(['RefreshToken', 'User']);
    await closeTestApp();
  });

  it('✅ refresh token صالح → 200 + pair جديد', async () => {
    const res = await req
      .post('/auth/refresh')
      .send({ refreshToken: firstRefreshToken });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('accessToken');
    expect(res.body).toHaveProperty('refreshToken');
    expect(res.body.refreshToken).not.toBe(firstRefreshToken);
  });

  it('❌ token مزور → 401', async () => {
    const res = await req
      .post('/auth/refresh')
      .send({ refreshToken: 'invalid.fake.token' });

    expect(res.status).toBe(401);
  });

  it('❌ استخدام نفس الـ token مرتين → 401 (rotation)', async () => {
    await cleanTables(['RefreshToken']);
    await seedUser(testPrisma as any, {
      email: 'rotation@clinic.com',
      password: 'Pass@1234',
    });
    const loginRes = await req
      .post('/auth/login')
      .send({ email: 'rotation@clinic.com', password: 'Pass@1234' });
    const token = loginRes.body.refreshToken;

    await req.post('/auth/refresh').send({ refreshToken: token });

    const res2 = await req
      .post('/auth/refresh')
      .send({ refreshToken: token });

    expect(res2.status).toBe(401);
  });
});