import SuperTest from 'supertest';
import { createTestApp, closeTestApp } from '../setup/app.setup';
import { testPrisma, cleanTables } from '../setup/db.setup';
import { seedUser } from '../setup/seed.helper';

describe('Auth + Permissions (integration)', () => {
  let req: SuperTest.Agent;

  beforeAll(async () => {
    ({ request: req } = await createTestApp());
    await cleanTables(['RefreshToken', 'User', 'Membership']);
  });

  afterAll(async () => {
    await cleanTables(['RefreshToken', 'User', 'Membership']);
    await closeTestApp();
  });

  beforeEach(async () => {
    await cleanTables(['RefreshToken', 'User', 'Membership']);
  });

  describe('JWT token generation and validation', () => {
    it('generates access token on login', async () => {
      await seedUser(testPrisma, {
        email: 'auth-int@clinic.com',
        password: 'Pass@1234',
        role: 'ADMIN',
      });

      const res = await req
        .post('/auth/login')
        .send({ email: 'auth-int@clinic.com', password: 'Pass@1234', hCaptchaToken: 'test-valid' });

      expect(res.status).toBe(200);
      expect(res.body.accessToken).toBeDefined();
      expect(res.body.refreshToken).toBeDefined();
    });

    it('rejects request without token', async () => {
      const res = await req.get('/admin/users');
      expect([401, 403]).toContain(res.status);
    });

    it('accepts request with valid token', async () => {
      await seedUser(testPrisma, {
        email: 'auth-valid@clinic.com',
        password: 'Pass@1234',
        role: 'ADMIN',
      });

      const loginRes = await req
        .post('/auth/login')
        .send({ email: 'auth-valid@clinic.com', password: 'Pass@1234', hCaptchaToken: 'test-valid' });

      const token = loginRes.body.accessToken;

      const meRes = await req
        .get('/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(meRes.status).toBe(200);
    });
  });

  describe('Role-based access', () => {
    it('ADMIN can access admin endpoints', async () => {
      await seedUser(testPrisma, {
        email: 'admin-perm@clinic.com',
        password: 'Pass@1234',
        role: 'ADMIN',
      });

      const loginRes = await req
        .post('/auth/login')
        .send({ email: 'admin-perm@clinic.com', password: 'Pass@1234', hCaptchaToken: 'test-valid' });

      const token = loginRes.body.accessToken;
      const res = await req
        .get('/admin/users')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).not.toBe(403);
    });
  });
});