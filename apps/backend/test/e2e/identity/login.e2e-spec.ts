import SuperTest from 'supertest';
import { createTestApp, closeTestApp } from '../../setup/app.setup';
import { testPrisma, cleanTables, flushTestRedis } from '../../setup/db.setup';
import { seedUser } from '../../setup/seed.helper';describe('POST /auth/login (e2e)', () => {
  let req: SuperTest.Agent;

  beforeAll(async () => {
    await flushTestRedis();
    ({ request: req } = await createTestApp());
    await cleanTables(['RefreshToken', 'User']);
    await seedUser(testPrisma as any, {
      email: 'admin@clinic.com',
      password: 'Pass@1234',
      role: 'ADMIN',
    });
  });

  afterAll(async () => {
    await cleanTables(['RefreshToken', 'User']);
    await closeTestApp();
  });

  it('✅ بيانات صحيحة → 200 + accessToken + refreshToken', async () => {
    const res = await req
      .post('/auth/login')
      .send({ email: 'admin@clinic.com', password: 'Pass@1234', hCaptchaToken: 'test-valid' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('accessToken');
    expect(res.body).toHaveProperty('refreshToken');
    expect(typeof res.body.accessToken).toBe('string');

    const tokens = await (testPrisma as any).refreshToken.count({ where: { } });
    expect(tokens).toBeGreaterThan(0);
  });

  it('❌ كلمة مرور خاطئة → 401', async () => {
    const res = await req
      .post('/auth/login')
      .send({ email: 'admin@clinic.com', password: 'WrongPass', hCaptchaToken: 'test-valid' });

    expect(res.status).toBe(401);
    expect(res.body).not.toHaveProperty('accessToken');
  });

  it('❌ مستخدم غير موجود → 401', async () => {
    const res = await req
      .post('/auth/login')
      .send({ email: 'ghost@clinic.com', password: 'Pass@1234', hCaptchaToken: 'test-valid' });

    expect(res.status).toBe(401);
  });

  it('❌ حساب غير مفعّل → 401', async () => {
    await seedUser(testPrisma as any, {
      email: 'inactive@clinic.com',
      password: 'Pass@1234',
      isActive: false,
    });

    const res = await req
      .post('/auth/login')
      .send({ email: 'inactive@clinic.com', password: 'Pass@1234', hCaptchaToken: 'test-valid' });

    expect(res.status).toBe(401);
  });

  it('⚠️ body فارغ → 400 validation error', async () => {
    const res = await req.post('/auth/login').send({});

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('message');
  });
});