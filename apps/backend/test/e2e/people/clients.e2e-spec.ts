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
    it('✅ قائمة فارغة → 200 + items []', async () => {
      const res = await req
        .get('/dashboard/people/clients')
        .set('x-tenant-id', TENANT)
        .set('Authorization', `Bearer ${TOKEN}`);

      expect(res.status).toBe(200);
      expect(res.body.items).toEqual([]);
    });

    it('✅ بعد إضافة client → يظهر في القائمة', async () => {
      await seedClient(testPrisma as any, TENANT, { name: 'أحمد محمد' });

      const res = await req
        .get('/dashboard/people/clients')
        .set('x-tenant-id', TENANT)
        .set('Authorization', `Bearer ${TOKEN}`);

      expect(res.status).toBe(200);
      expect(res.body.items.length).toBeGreaterThan(0);
    });

    it('❌ بدون JWT → 401', async () => {
      const res = await req
        .get('/dashboard/people/clients')
        .set('x-tenant-id', TENANT);

      expect(res.status).toBe(401);
    });
  });

  describe('POST /dashboard/people/clients', () => {
    it('✅ إنشاء client → 201 + name مُركَّب من first/last', async () => {
      const phone = `+9665${Date.now().toString().slice(-8)}`;

      const res = await req
        .post('/dashboard/people/clients')
        .set('x-tenant-id', TENANT)
        .set('Authorization', `Bearer ${TOKEN}`)
        .send({ firstName: 'سارة', lastName: 'العلي', phone, gender: 'female' });

      expect(res.status).toBe(201);

      const inDb = await (testPrisma as any).client.findUnique({ where: { id: res.body.id } });
      expect(inDb).not.toBeNull();
      expect(inDb.firstName).toBe('سارة');
      expect(inDb.lastName).toBe('العلي');
      expect(inDb.name).toBe('سارة العلي');
    });

    it('❌ firstName مفقود → 400', async () => {
      const res = await req
        .post('/dashboard/people/clients')
        .set('x-tenant-id', TENANT)
        .set('Authorization', `Bearer ${TOKEN}`)
        .send({ lastName: 'فقط', phone: '+966501234567' });

      expect(res.status).toBe(400);
    });

    it('❌ phone بصيغة غير E.164 → 400', async () => {
      const res = await req
        .post('/dashboard/people/clients')
        .set('x-tenant-id', TENANT)
        .set('Authorization', `Bearer ${TOKEN}`)
        .send({ firstName: 'Bad', lastName: 'Phone', phone: '0501234567' });

      expect(res.status).toBe(400);
    });

    it('❌ phone مكرّر → 409', async () => {
      const phone = `+9665${Date.now().toString().slice(-8)}`;
      await req
        .post('/dashboard/people/clients')
        .set('x-tenant-id', TENANT)
        .set('Authorization', `Bearer ${TOKEN}`)
        .send({ firstName: 'Orig', lastName: 'Client', phone });

      const res = await req
        .post('/dashboard/people/clients')
        .set('x-tenant-id', TENANT)
        .set('Authorization', `Bearer ${TOKEN}`)
        .send({ firstName: 'Dup', lastName: 'Client', phone });

      expect(res.status).toBe(409);
    });

    it('❌ بدون JWT → 401', async () => {
      const res = await req
        .post('/dashboard/people/clients')
        .set('x-tenant-id', TENANT)
        .send({ firstName: 'Un', lastName: 'Auth', phone: '+966500000000' });

      expect(res.status).toBe(401);
    });
  });

  describe('PATCH /dashboard/people/clients/:id', () => {
    it('✅ تحديث firstName → DB تتغير + name يُعاد تركيبه', async () => {
      const client = await seedClient(testPrisma as any, TENANT, {
        name: 'Old Name',
        firstName: 'Old',
        lastName: 'Name',
      });

      const res = await req
        .patch(`/dashboard/people/clients/${client.id}`)
        .set('x-tenant-id', TENANT)
        .set('Authorization', `Bearer ${TOKEN}`)
        .send({ firstName: 'New' });

      expect(res.status).toBe(200);

      const inDb = await (testPrisma as any).client.findUnique({ where: { id: client.id } });
      expect(inDb.firstName).toBe('New');
      expect(inDb.name).toBe('New Name');
    });

    it('❌ تحديث phone إلى رقم مستخدم لعميل آخر → 409', async () => {
      const c1 = await seedClient(testPrisma as any, TENANT, {
        name: 'A',
        firstName: 'A',
        lastName: 'A',
        phone: `+9665${Date.now().toString().slice(-8)}`,
      });
      const otherPhone = `+9665${(Date.now() + 1).toString().slice(-8)}`;
      await seedClient(testPrisma as any, TENANT, {
        name: 'B',
        firstName: 'B',
        lastName: 'B',
        phone: otherPhone,
      });

      const res = await req
        .patch(`/dashboard/people/clients/${c1.id}`)
        .set('x-tenant-id', TENANT)
        .set('Authorization', `Bearer ${TOKEN}`)
        .send({ phone: otherPhone });

      expect(res.status).toBe(409);
    });

    it('❌ ID غير موجود → 404', async () => {
      const res = await req
        .patch('/dashboard/people/clients/00000000-0000-0000-0000-000000000000')
        .set('x-tenant-id', TENANT)
        .set('Authorization', `Bearer ${TOKEN}`)
        .send({ firstName: 'Ghost' });

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /dashboard/people/clients/:id', () => {
    it('✅ soft-delete → 204 + list لا يُعيد المحذوف', async () => {
      const c = await seedClient(testPrisma as any, TENANT, {
        name: 'To Remove',
        firstName: 'To',
        lastName: 'Remove',
        phone: `+9665${Date.now().toString().slice(-8)}`,
      });

      const delRes = await req
        .delete(`/dashboard/people/clients/${c.id}`)
        .set('x-tenant-id', TENANT)
        .set('Authorization', `Bearer ${TOKEN}`);
      expect(delRes.status).toBe(204);

      const listRes = await req
        .get('/dashboard/people/clients')
        .set('x-tenant-id', TENANT)
        .set('Authorization', `Bearer ${TOKEN}`);
      expect(listRes.body.items.find((c2: { id: string }) => c2.id === c.id)).toBeUndefined();

      const getRes = await req
        .get(`/dashboard/people/clients/${c.id}`)
        .set('x-tenant-id', TENANT)
        .set('Authorization', `Bearer ${TOKEN}`);
      expect(getRes.status).toBe(404);
    });

    it('❌ ID غير موجود → 404', async () => {
      const res = await req
        .delete('/dashboard/people/clients/00000000-0000-0000-0000-000000000000')
        .set('x-tenant-id', TENANT)
        .set('Authorization', `Bearer ${TOKEN}`);

      expect(res.status).toBe(404);
    });
  });
});
