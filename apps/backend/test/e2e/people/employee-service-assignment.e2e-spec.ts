import SuperTest from 'supertest';
import { createTestApp, closeTestApp } from '../../setup/app.setup';
import { testPrisma, cleanTables } from '../../setup/db.setup';
import {
  seedClient,
  seedEmployee,
  seedService,
  seedBranch,
  seedEmployeeService,
  seedEmployeeAvailability,
} from '../../setup/seed.helper';
import { createTestToken, adminUser, ensureTestUsers } from '../../setup/auth.helper';

describe('Employee Service Assignment (e2e)', () => {
  let req: SuperTest.Agent;
  let TOKEN: string;
  let employeeId: string;
  let serviceId: string;
  let branchId: string;

  beforeAll(async () => {
    ({ request: req } = await createTestApp());
    await ensureTestUsers();
    TOKEN = createTestToken(adminUser);
    await cleanTables([
      'Booking',
      'Invoice',
      'Client',
      'Employee',
      'Service',
      'Branch',
      'EmployeeAvailability',
      'EmployeeService',
    ]);

    const [employee, service, branch] = await Promise.all([
      seedEmployee(testPrisma as never, { name: 'Dr. Assignment' }),
      seedService(testPrisma as never, { nameAr: 'خدمة التعيين', durationMins: 45, price: 150 }),
      seedBranch(testPrisma as never, { nameAr: 'فرع التعيين' }),
    ]);

    employeeId = employee.id;
    serviceId = service.id;
    branchId = branch.id;
  });

  afterAll(async () => {
    await cleanTables([
      'Booking',
      'Invoice',
      'Client',
      'Employee',
      'Service',
      'Branch',
      'EmployeeAvailability',
      'EmployeeService',
    ]);
    await closeTestApp();
  });

  it('[EMP-SVC-001][Employee/services][P1-High] list services for employee returns empty initially', async () => {
    const res = await req
      .get(`/dashboard/people/employees/${employeeId}/services`)
      .set('Authorization', `Bearer ${TOKEN}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(0);
  });

  it('[EMP-SVC-002][Employee/services][P1-High] assign service to employee succeeds', async () => {
    const res = await req
      .post(`/dashboard/people/employees/${employeeId}/services`)
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({ serviceId });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('employeeId');
    expect(res.body).toHaveProperty('serviceId');
  });

  it('[EMP-SVC-003][Employee/services][P1-High] list services returns assigned service', async () => {
    const res = await req
      .get(`/dashboard/people/employees/${employeeId}/services`)
      .set('Authorization', `Bearer ${TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].serviceId).toBe(serviceId);
  });

  it('[EMP-SVC-004][Employee/services][P1-High] booking succeeds after service assignment', async () => {
    await seedEmployeeAvailability(testPrisma as never, employeeId, {
      startTime: '09:00',
      endTime: '17:00',
    });

    const client = await seedClient(testPrisma as never);

    const res = await req
      .post('/dashboard/bookings')
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({
        clientId: client.id,
        employeeId,
        serviceId,
        branchId,
        scheduledAt: new Date(Date.now() + 3 * 86_400_000).toISOString(),
        bookingType: 'INDIVIDUAL',
      });

    expect(res.status).toBe(201);
    expect(res.body.employeeId).toBe(employeeId);
    expect(res.body.serviceId).toBe(serviceId);
  });

  it('[EMP-SVC-005][Employee/services][P2-Medium] duplicate assignment returns 409', async () => {
    const res = await req
      .post(`/dashboard/people/employees/${employeeId}/services`)
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({ serviceId });

    expect(res.status).toBe(409);
  });

  it('[EMP-SVC-006][Employee/services][P1-High] remove service from employee', async () => {
    const res = await req
      .delete(`/dashboard/people/employees/${employeeId}/services/${serviceId}`)
      .set('Authorization', `Bearer ${TOKEN}`);

    expect(res.status).toBe(204);

    const listRes = await req
      .get(`/dashboard/people/employees/${employeeId}/services`)
      .set('Authorization', `Bearer ${TOKEN}`);

    expect(listRes.body.length).toBe(0);
  });

  it('[EMP-SVC-007][Employee/services][P1-High] booking fails after service removal', async () => {
    const client = await seedClient(testPrisma as never);

    const res = await req
      .post('/dashboard/bookings')
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({
        clientId: client.id,
        employeeId,
        serviceId,
        branchId,
        scheduledAt: new Date(Date.now() + 4 * 86_400_000).toISOString(),
        bookingType: 'INDIVIDUAL',
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/employee.*service/i);
  });

  it('[EMP-SVC-008][Employee/services][P1-High] 401 without JWT', async () => {
    const res = await req
      .post(`/dashboard/people/employees/${employeeId}/services`)
      .send({ serviceId });

    expect(res.status).toBe(401);
  });

  it('[EMP-SVC-009][Employee/services][P2-Medium] 404 for non-existent employee', async () => {
    const fakeEmployeeId = '00000000-0000-0000-0000-000000000000';

    const res = await req
      .get(`/dashboard/people/employees/${fakeEmployeeId}/services`)
      .set('Authorization', `Bearer ${TOKEN}`);

    expect(res.status).toBe(404);
  });
});