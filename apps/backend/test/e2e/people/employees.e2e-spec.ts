import SuperTest from 'supertest';
import { createTestApp, closeTestApp } from '../../setup/app.setup';
import { testPrisma, cleanTables } from '../../setup/db.setup';
import { seedEmployee } from '../../setup/seed.helper';
import { createTestToken, adminUser } from '../../setup/auth.helper';describe('Employees API (e2e)', () => {
  let req: SuperTest.Agent;
  let TOKEN: string;

  beforeAll(async () => {
    ({ request: req } = await createTestApp());
    TOKEN = createTestToken(adminUser);
    await cleanTables(['Employee']);
  });

  afterAll(async () => {
    await cleanTables(['Employee']);
    await closeTestApp();
  });

  it('✅ قائمة الموظفين → 200', async () => {
    await seedEmployee(testPrisma as any, { name: 'Dr. خالد' });

    const res = await req
      .get('/dashboard/people/employees')
      .set('Authorization', `Bearer ${TOKEN}`);

    expect(res.status).toBe(200);
  });

  it('✅ إنشاء موظف → 201 + يُحفظ في DB', async () => {
    const res = await req
      .post('/dashboard/people/employees')
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({ name: 'Dr. نورة', employmentType: 'FULL_TIME', gender: 'FEMALE' });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');

    const inDb = await (testPrisma as any).employee.findUnique({ where: { id: res.body.id } });
    expect(inDb).not.toBeNull();
  });

  it('❌ بيانات ناقصة → 400', async () => {
    const res = await req
      .post('/dashboard/people/employees')
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({});

    expect(res.status).toBe(400);
  });

  it('❌ بدون JWT → 401', async () => {
    const res = await req
      .post('/dashboard/people/employees')
      .send({ name: 'Unauthorized', employmentType: 'FULL_TIME' });

    expect(res.status).toBe(401);
  });

  it('✅ GET موظف بـ ID → 200 + بيانات كاملة', async () => {
    const emp = await seedEmployee(testPrisma as any, { name: 'Dr. فيصل' });

    const res = await req
      .get(`/dashboard/people/employees/${emp.id}`)
      .set('Authorization', `Bearer ${TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(emp.id);
    expect(res.body.name).toBe('Dr. فيصل');
  });

  it('❌ GET موظف بـ ID غير موجود → 404', async () => {
    const res = await req
      .get('/dashboard/people/employees/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${TOKEN}`);

    expect(res.status).toBe(404);
  });
});