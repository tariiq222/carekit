import SuperTest from 'supertest';
import { createTestApp, closeTestApp } from '../../setup/app.setup';
import { testPrisma, cleanTables } from '../../setup/db.setup';
import { seedClient, seedEmployee, seedService, seedBranch } from '../../setup/seed.helper';
import { createTestToken, adminUser, TEST_TENANT_ID } from '../../setup/auth.helper';

const TENANT = TEST_TENANT_ID;

describe('Waitlist API (e2e)', () => {
  let req: SuperTest.Agent;
  let clientId: string;
  let employeeId: string;
  let serviceId: string;
  let branchId: string;
  let TOKEN: string;

  beforeAll(async () => {
    ({ request: req } = await createTestApp());
    TOKEN = createTestToken(adminUser);
    await cleanTables(['WaitlistEntry', 'Client', 'Employee', 'Service', 'Branch']);

    const [client, employee, service, branch] = await Promise.all([
      seedClient(testPrisma as any, TENANT),
      seedEmployee(testPrisma as any, TENANT),
      seedService(testPrisma as any, TENANT),
      seedBranch(testPrisma as any, TENANT),
    ]);
    clientId = client.id;
    employeeId = employee.id;
    serviceId = service.id;
    branchId = branch.id;
  });

  afterAll(async () => {
    await cleanTables(['WaitlistEntry', 'Client', 'Employee', 'Service', 'Branch']);
    await closeTestApp();
  });

  it('✅ إضافة إلى الـ waitlist → 201 + WAITING في DB', async () => {
    const res = await req
      .post('/dashboard/bookings/waitlist')
      .set('x-tenant-id', TENANT)
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({ clientId, employeeId, serviceId, branchId });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');

    const inDb = await (testPrisma as any).waitlistEntry.findUnique({ where: { id: res.body.id } });
    expect(inDb).not.toBeNull();
  });

  it('❌ بدون JWT → 401', async () => {
    const res = await req
      .post('/dashboard/bookings/waitlist')
      .set('x-tenant-id', TENANT)
      .send({ clientId, employeeId, serviceId, branchId });

    expect(res.status).toBe(401);
  });
});