import SuperTest from 'supertest';
import { createTestApp, closeTestApp } from '../../setup/app.setup';
import { cleanTables } from '../../setup/db.setup';
import { createTestToken, adminUser } from '../../setup/auth.helper';describe('Payments API (e2e)', () => {
  let req: SuperTest.Agent;
  let TOKEN: string;

  beforeAll(async () => {
    ({ request: req } = await createTestApp());
    TOKEN = createTestToken(adminUser);
  });

  afterAll(async () => {
    await closeTestApp();
  });

  it('✅ قائمة المدفوعات → 200', async () => {
    const res = await req
      .get('/dashboard/finance/payments')
      .set('Authorization', `Bearer ${TOKEN}`);

    expect(res.status).toBe(200);
  });

  it('❌ بدون JWT → 401', async () => {
    const res = await req
      .get('/dashboard/finance/payments')
      ;

    expect(res.status).toBe(401);
  });
});