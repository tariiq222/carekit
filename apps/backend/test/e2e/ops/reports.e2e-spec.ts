import SuperTest from 'supertest';
import { createTestApp, closeTestApp } from '../../setup/app.setup';
import { createTestToken, adminUser } from '../../setup/auth.helper';const from = new Date(Date.now() - 30 * 86_400_000).toISOString();
const to = new Date().toISOString();

describe('Ops / Reports API (e2e)', () => {
  let req: SuperTest.Agent;
  let TOKEN: string;

  beforeAll(async () => {
    ({ request: req } = await createTestApp());
    TOKEN = createTestToken(adminUser);
  });

  afterAll(async () => {
    await closeTestApp();
  });

  it('✅ revenue report → 200', async () => {
    const res = await req
      .post('/dashboard/ops/reports')
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({ type: 'REVENUE', from, to });

    expect(res.status).toBe(200);
  });

  it('✅ activity report → 200', async () => {
    const res = await req
      .post('/dashboard/ops/reports')
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({ type: 'ACTIVITY', from, to });

    expect(res.status).toBe(200);
  });

  it('❌ from بدون to → 400', async () => {
    const res = await req
      .post('/dashboard/ops/reports')
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({ type: 'REVENUE', from: '2026-01-01' });

    expect(res.status).toBe(400);
  });

  it('❌ بدون JWT → 401', async () => {
    const res = await req
      .post('/dashboard/ops/reports')
      .send({ type: 'REVENUE', from, to });

    expect(res.status).toBe(401);
  });
});