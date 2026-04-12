import SuperTest from 'supertest';
import { createTestApp, closeTestApp } from '../../setup/app.setup';
import { testPrisma, cleanTables } from '../../setup/db.setup';
import { seedBranch } from '../../setup/seed.helper';
import { createTestToken, adminUser, TEST_TENANT_ID } from '../../setup/auth.helper';

const TENANT = TEST_TENANT_ID;

describe('Org-Config — Branches API (e2e)', () => {
  let req: SuperTest.Agent;
  let TOKEN: string;

  beforeAll(async () => {
    ({ request: req } = await createTestApp());
    TOKEN = createTestToken(adminUser);
    await cleanTables(['BusinessHour', 'Branch']);
  });

  afterAll(async () => {
    await cleanTables(['BusinessHour', 'Branch']);
    await closeTestApp();
  });

  it('✅ إنشاء فرع → 201 + يُحفظ في DB', async () => {
    const res = await req
      .post('/dashboard/organization/branches')
      .set('x-tenant-id', TENANT)
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({ nameAr: 'فرع الرياض', nameEn: 'Riyadh Branch' });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');

    const inDb = await (testPrisma as any).branch.findUnique({ where: { id: res.body.id } });
    expect(inDb).not.toBeNull();
    expect(inDb.nameAr).toBe('فرع الرياض');
  });

  it('✅ قائمة الفروع → 200', async () => {
    const res = await req
      .get('/dashboard/organization/branches')
      .set('x-tenant-id', TENANT)
      .set('Authorization', `Bearer ${TOKEN}`);

    expect(res.status).toBe(200);
  });

  it('✅ تحديث فرع → DB تتغير', async () => {
    const branch = await seedBranch(testPrisma as any, TENANT, { nameAr: 'Old' });

    const res = await req
      .patch(`/dashboard/organization/branches/${branch.id}`)
      .set('x-tenant-id', TENANT)
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({ nameAr: 'Updated' });

    expect(res.status).toBe(200);

    const inDb = await (testPrisma as any).branch.findUnique({ where: { id: branch.id } });
    expect(inDb.nameAr).toBe('Updated');
  });

  it('❌ اسمAr مفقود → 400', async () => {
    const res = await req
      .post('/dashboard/organization/branches')
      .set('x-tenant-id', TENANT)
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({});

    expect(res.status).toBe(400);
  });

  it('❌ ID غير موجود → 404', async () => {
    const res = await req
      .patch('/dashboard/organization/branches/00000000-0000-0000-0000-000000000000')
      .set('x-tenant-id', TENANT)
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({ nameAr: 'Ghost' });

    expect(res.status).toBe(404);
  });
});