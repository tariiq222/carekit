import SuperTest from 'supertest';
import { createTestApp, closeTestApp } from '../../setup/app.setup';
import { testPrisma, cleanTables } from '../../setup/db.setup';
import { seedClient, seedEmployee, seedService, seedBranch, seedBooking } from '../../setup/seed.helper';
import { createTestToken, adminUser, TEST_TENANT_ID } from '../../setup/auth.helper';

const TENANT = TEST_TENANT_ID;

describe('Invoices API (e2e)', () => {
  let req: SuperTest.Agent;
  let bookingId: string;
  let clientId: string;
  let employeeId: string;
  let branchId: string;
  let TOKEN: string;

  beforeAll(async () => {
    ({ request: req } = await createTestApp());
    TOKEN = createTestToken(adminUser);
    await cleanTables(['Invoice', 'Booking', 'Client', 'Employee', 'Service', 'Branch']);

    const [client, employee, service, branch] = await Promise.all([
      seedClient(testPrisma as any, TENANT),
      seedEmployee(testPrisma as any, TENANT),
      seedService(testPrisma as any, TENANT, { price: 300 }),
      seedBranch(testPrisma as any, TENANT),
    ]);
    clientId = client.id;
    employeeId = employee.id;
    branchId = branch.id;

    const booking = await seedBooking(testPrisma as any, TENANT, {
      clientId: client.id,
      employeeId: employee.id,
      serviceId: service.id,
      branchId: branch.id,
      status: 'COMPLETED',
    });
    bookingId = booking.id;
  });

  afterAll(async () => {
    await cleanTables(['Invoice', 'Booking', 'Client', 'Employee', 'Service', 'Branch']);
    await closeTestApp();
  });

  it('✅ إنشاء فاتورة → 201 + يُحفظ في DB', async () => {
    const res = await req
      .post('/dashboard/finance/invoices')
      .set('x-tenant-id', TENANT)
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({ bookingId, branchId, clientId, employeeId, subtotal: 300 });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(Number(res.body.total)).toBeGreaterThan(0);

    const inDb = await (testPrisma as any).invoice.findUnique({ where: { id: res.body.id } });
    expect(inDb).not.toBeNull();
    expect(inDb.bookingId).toBe(bookingId);
  });

  it('❌ فاتورة مكررة لنفس الحجز → 409', async () => {
    const [client, employee, service, branch] = await Promise.all([
      seedClient(testPrisma as any, TENANT),
      seedEmployee(testPrisma as any, TENANT),
      seedService(testPrisma as any, TENANT),
      seedBranch(testPrisma as any, TENANT),
    ]);
    const booking = await seedBooking(testPrisma as any, TENANT, {
      clientId: client.id, employeeId: employee.id,
      serviceId: service.id, branchId: branch.id, status: 'COMPLETED',
    });

    await req
      .post('/dashboard/finance/invoices')
      .set('x-tenant-id', TENANT)
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({ bookingId: booking.id, branchId: branch.id, clientId: client.id, employeeId: employee.id, subtotal: 200 });

    const res = await req
      .post('/dashboard/finance/invoices')
      .set('x-tenant-id', TENANT)
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({ bookingId: booking.id, branchId: branch.id, clientId: client.id, employeeId: employee.id, subtotal: 200 });

    expect(res.status).toBe(409);
  });

  it('❌ بدون JWT → 401', async () => {
    const res = await req
      .post('/dashboard/finance/invoices')
      .set('x-tenant-id', TENANT)
      .send({ bookingId, branchId, clientId, employeeId, subtotal: 100 });

    expect(res.status).toBe(401);
  });
});