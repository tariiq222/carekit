import SuperTest from 'supertest';
import { createTestApp, closeTestApp } from '../../setup/app.setup';
import { testPrisma, cleanTables } from '../../setup/db.setup';
import { seedService } from '../../setup/seed.helper';
import { createTestToken, adminUser, TEST_TENANT_ID } from '../../setup/auth.helper';

const TENANT = TEST_TENANT_ID;

describe('Services API (e2e)', () => {
  let req: SuperTest.Agent;
  let TOKEN: string;

  beforeAll(async () => {
    ({ request: req } = await createTestApp());
    TOKEN = createTestToken(adminUser);
    await cleanTables(['Service']);
  });

  afterAll(async () => {
    await cleanTables(['Service']);
    await closeTestApp();
  });

  it('✅ إنشاء خدمة → 201 + يُحفظ في DB', async () => {
    const res = await req
      .post('/dashboard/organization/services')
      .set('x-tenant-id', TENANT)
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({ nameAr: 'تنظيف أسنان', nameEn: 'Teeth Cleaning', durationMins: 45, price: 250, currency: 'SAR' });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.nameAr).toBe('تنظيف أسنان');

    const inDb = await (testPrisma as any).service.findUnique({ where: { id: res.body.id } });
    expect(inDb).not.toBeNull();
    expect(Number(inDb.price)).toBe(250);
  });

  it('✅ قائمة الخدمات → 200 + الخدمة تظهر فيها', async () => {
    await seedService(testPrisma as any, TENANT, { nameAr: 'فحص شامل' });

    const res = await req
      .get('/dashboard/organization/services')
      .set('x-tenant-id', TENANT)
      .set('Authorization', `Bearer ${TOKEN}`);

    expect(res.status).toBe(200);
  });

  it('✅ تحديث سعر الخدمة → DB تتغير', async () => {
    const service = await seedService(testPrisma as any, TENANT, { price: 100 });

    const res = await req
      .patch(`/dashboard/organization/services/${service.id}`)
      .set('x-tenant-id', TENANT)
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({ price: 150 });

    expect(res.status).toBe(200);

    const inDb = await (testPrisma as any).service.findUnique({ where: { id: service.id } });
    expect(Number(inDb.price)).toBe(150);
  });

  it('❌ حقول مطلوبة مفقودة → 400', async () => {
    const res = await req
      .post('/dashboard/organization/services')
      .set('x-tenant-id', TENANT)
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({ price: 100 });

    expect(res.status).toBe(400);
  });

  it('❌ بدون JWT → 401', async () => {
    const res = await req
      .get('/dashboard/organization/services')
      .set('x-tenant-id', TENANT);

    expect(res.status).toBe(401);
  });
});