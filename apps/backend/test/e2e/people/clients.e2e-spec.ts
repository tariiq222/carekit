import SuperTest from 'supertest';
import { createTestApp, closeTestApp } from '../../setup/app.setup';
import { testPrisma, cleanTables } from '../../setup/db.setup';
import { seedClient } from '../../setup/seed.helper';
import { createTestToken, adminUser, TEST_TENANT_ID } from '../../setup/auth.helper';

const TENANT = TEST_TENANT_ID;

describe('Clients API (e2e)', () => {
  let req: SuperTest.Agent;
  let TOKEN: string;

  beforeAll(async () => {
    ({ request: req } = await createTestApp());
    TOKEN = createTestToken(adminUser);
    await cleanTables(['Client']);
  });

  afterAll(async () => {
    await cleanTables(['Client']);
    await closeTestApp();
  });

  describe('GET /dashboard/people/clients', () => {
    it('✅ قائمة فارغة → 200', async () => {
      const res = await req
        .get('/dashboard/people/clients')
        .set('x-tenant-id', TENANT)
        .set('Authorization', `Bearer ${TOKEN}`);

      expect(res.status).toBe(200);
    });

    it('✅ بعد إضافة client → يظهر في القائمة', async () => {
      await seedClient(testPrisma as any, TENANT, { name: 'أحمد محمد' });

      const res = await req
        .get('/dashboard/people/clients')
        .set('x-tenant-id', TENANT)
        .set('Authorization', `Bearer ${TOKEN}`);

      expect(res.status).toBe(200);
    });

    it('❌ بدون JWT → 401', async () => {
      const res = await req
        .get('/dashboard/people/clients')
        .set('x-tenant-id', TENANT);

      expect(res.status).toBe(401);
    });
  });

  describe('POST /dashboard/people/clients', () => {
    it('✅ إنشاء client → 201 + يُحفظ في DB', async () => {
      const phone = `+9665${Date.now().toString().slice(-8)}`;

      const res = await req
        .post('/dashboard/people/clients')
        .set('x-tenant-id', TENANT)
        .set('Authorization', `Bearer ${TOKEN}`)
        .send({ name: 'سارة العلي', phone, gender: 'FEMALE' });

      expect(res.status).toBe(201);

      const inDb = await (testPrisma as any).client.findUnique({ where: { id: res.body.id } });
      expect(inDb).not.toBeNull();
      expect(inDb.name).toBe('سارة العلي');
    });

    it('❌ اسم مفقود → 400', async () => {
      const res = await req
        .post('/dashboard/people/clients')
        .set('x-tenant-id', TENANT)
        .set('Authorization', `Bearer ${TOKEN}`)
        .send({ phone: '+966501234567' });

      expect(res.status).toBe(400);
    });

    it('❌ بدون JWT → 401', async () => {
      const res = await req
        .post('/dashboard/people/clients')
        .set('x-tenant-id', TENANT)
        .send({ name: 'Unauthorized' });

      expect(res.status).toBe(401);
    });
  });

  describe('PATCH /dashboard/people/clients/:id', () => {
    it('✅ تحديث اسم → DB تتغير', async () => {
      const client = await seedClient(testPrisma as any, TENANT, { name: 'Old Name' });

      const res = await req
        .patch(`/dashboard/people/clients/${client.id}`)
        .set('x-tenant-id', TENANT)
        .set('Authorization', `Bearer ${TOKEN}`)
        .send({ name: 'New Name' });

      expect(res.status).toBe(200);

      const inDb = await (testPrisma as any).client.findUnique({ where: { id: client.id } });
      expect(inDb.name).toBe('New Name');
    });

    it('❌ ID غير موجود → 404', async () => {
      const res = await req
        .patch('/dashboard/people/clients/00000000-0000-0000-0000-000000000000')
        .set('x-tenant-id', TENANT)
        .set('Authorization', `Bearer ${TOKEN}`)
        .send({ name: 'Ghost' });

      expect(res.status).toBe(404);
    });
  });
});