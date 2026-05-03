import SuperTest from 'supertest';
import { createTestApp, closeTestApp } from '../../setup/app.setup';
import { testPrisma, cleanTables } from '../../setup/db.setup';
import { seedClient, seedEmployee, seedService, seedBranch, seedEmployeeService, seedEmployeeAvailability } from '../../setup/seed.helper';
import { createTestToken, adminUser } from '../../setup/auth.helper';describe('POST /dashboard/bookings (e2e)', () => {
  let req: SuperTest.Agent;
  let clientId: string;
  let employeeId: string;
  let serviceId: string;
  let branchId: string;
  let TOKEN: string;

  beforeAll(async () => {
    ({ request: req } = await createTestApp());
    TOKEN = createTestToken(adminUser);
    await cleanTables(['Booking', 'WaitlistEntry', 'Client', 'Employee', 'Service', 'Branch']);

    const [client, employee, service, branch] = await Promise.all([
      seedClient(testPrisma as any),
      seedEmployee(testPrisma as any),
      seedService(testPrisma as any, { durationMins: 60, price: 200 }),
      seedBranch(testPrisma as any),
    ]);
    clientId = client.id;
    employeeId = employee.id;
    serviceId = service.id;
    branchId = branch.id;

    await seedEmployeeService(testPrisma as any, employeeId, serviceId);
    await seedEmployeeAvailability(testPrisma as any, employeeId);
  });

  afterAll(async () => {
    await cleanTables(['Booking', 'WaitlistEntry', 'Client', 'Employee', 'Service', 'Branch']);
    await closeTestApp();
  });

  const future = () => new Date(Date.now() + 86_400_000).toISOString();

  it('✅ حجز صحيح → 201 + PENDING في DB', async () => {
    const res = await req
      .post('/dashboard/bookings')
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({ clientId, employeeId, serviceId, branchId, scheduledAt: future(), bookingType: 'INDIVIDUAL' });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.status).toBe('PENDING');

    const inDb = await (testPrisma as any).booking.findUnique({ where: { id: res.body.id } });
    expect(inDb).not.toBeNull();
    expect(inDb.status).toBe('PENDING');
  });

  it('❌ employeeId مفقود → 400', async () => {
    const res = await req
      .post('/dashboard/bookings')
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({ clientId, serviceId, branchId, scheduledAt: future(), bookingType: 'INDIVIDUAL' });

    expect(res.status).toBe(400);
  });

  it('❌ بدون JWT → 401', async () => {
    const res = await req
      .post('/dashboard/bookings')
      .send({ clientId, employeeId, serviceId, branchId, scheduledAt: future(), bookingType: 'INDIVIDUAL' });

    expect(res.status).toBe(401);
  });
});