import SuperTest from 'supertest';
import { createTestApp, closeTestApp } from '../../setup/app.setup';
import { testPrisma, cleanTables } from '../../setup/db.setup';
import {
  seedClient,
  seedEmployee,
  seedService,
  seedBranch,
  seedBooking,
  seedEmployeeService,
} from '../../setup/seed.helper';
import { createTestToken, adminUser, ensureTestUsers } from '../../setup/auth.helper';

describe('Reports API — Aggregates (e2e)', () => {
  let req: SuperTest.Agent;
  let TOKEN: string;
  let branchId: string;
  let employeeId: string;
  let clientId: string;
  let serviceId: string;

  const from = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const to = new Date().toISOString();

  beforeAll(async () => {
    ({ request: req } = await createTestApp());
    await ensureTestUsers();
    TOKEN = createTestToken(adminUser);
    await cleanTables([
      'Report',
      'Payment',
      'Invoice',
      'Booking',
      'Client',
      'Employee',
      'Service',
      'Branch',
    ]);

    const [client, employee, service, branch] = await Promise.all([
      seedClient(testPrisma as never),
      seedEmployee(testPrisma as never, { name: 'Dr. Reports' }),
      seedService(testPrisma as never, { nameAr: 'خدمة التقارير', price: 500 }),
      seedBranch(testPrisma as never, { nameAr: 'فرع التقارير' }),
    ]);

    clientId = client.id;
    employeeId = employee.id;
    serviceId = service.id;
    branchId = branch.id;

    await seedEmployeeService(testPrisma as never, employeeId, serviceId);
  });

  afterAll(async () => {
    await cleanTables([
      'Report',
      'Payment',
      'Invoice',
      'Booking',
      'Client',
      'Employee',
      'Service',
      'Branch',
    ]);
    await closeTestApp();
  });

  async function createCompletedBookingWithPayment(price: number, status: string = 'COMPLETED') {
    const booking = await seedBooking(testPrisma as never, {
      clientId,
      employeeId,
      serviceId,
      branchId,
      status,
      scheduledAt: new Date(Date.now() - 5 * 86_400_000),
    });

    const invRes = await req
      .post('/dashboard/finance/invoices')
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({
        bookingId: booking.id,
        branchId,
        clientId,
        employeeId,
        subtotal: price,
      });
    expect(invRes.status).toBe(201);
    const invoiceId = invRes.body.id;

    const payRes = await req
      .post('/dashboard/finance/payments')
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({ invoiceId, amount: price, method: 'CASH' });
    expect(payRes.status).toBe(201);

    return { booking, invoiceId };
  }

  it('[REPORT-001][Reports/revenue][P1-High] revenue report aggregates match actual bookings and payments', async () => {
    await createCompletedBookingWithPayment(300);
    await createCompletedBookingWithPayment(500);
    await createCompletedBookingWithPayment(200);

    const res = await req
      .post('/dashboard/ops/reports')
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({ type: 'REVENUE', from, to });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('reportId');
    expect(res.body).toHaveProperty('data');

    const data = res.body.data;
    expect(data.summary.totalBookings).toBe(3);
    expect(data.summary.totalPayments).toBe(3);
    expect(data.summary.totalRevenue).toBe(1000);
    expect(data.summary.completedBookings).toBe(3);
    expect(data.byEmployee).toHaveLength(1);
    expect(Number(data.byEmployee[0].revenue)).toBe(1000);
  });

  it('[REPORT-002][Reports/revenue][P1-High] cancelled bookings excluded from revenue but counted', async () => {
    await createCompletedBookingWithPayment(400);
    await seedBooking(testPrisma as never, {
      clientId,
      employeeId,
      serviceId,
      branchId,
      status: 'CANCELLED',
      scheduledAt: new Date(Date.now() - 4 * 86_400_000),
    });

    const res = await req
      .post('/dashboard/ops/reports')
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({ type: 'REVENUE', from, to });

    expect(res.status).toBe(200);
    const data = res.body.data;
    expect(data.summary.totalBookings).toBeGreaterThanOrEqual(4);
    expect(data.summary.cancelledBookings).toBeGreaterThanOrEqual(1);
  });

  it('[REPORT-003][Reports/activity][P2-Medium] activity report returns structure with summary', async () => {
    const res = await req
      .post('/dashboard/ops/reports')
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({ type: 'ACTIVITY', from, to });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');

    const data = res.body.data;
    expect(data).toHaveProperty('period');
    expect(data).toHaveProperty('summary');
    expect(data.summary).toHaveProperty('totalActions');
    expect(data.summary).toHaveProperty('uniqueUsers');
    expect(Array.isArray(data.byDay)).toBe(true);
  });

  it('[REPORT-004][Reports/activity][P2-Medium] bookings report returns counts by status', async () => {
    const res = await req
      .post('/dashboard/ops/reports')
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({ type: 'BOOKINGS', from, to });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');

    const data = res.body.data;
    expect(data).toHaveProperty('total');
    expect(data).toHaveProperty('byStatus');
    expect(Array.isArray(data.byStatus)).toBe(true);
  });

  it('[REPORT-005][Reports/security][P1-High] 401 without JWT', async () => {
    const res = await req
      .post('/dashboard/ops/reports')
      .send({ type: 'REVENUE', from, to });

    expect(res.status).toBe(401);
  });

  it('[REPORT-006][Reports/validation][P2-Medium] from > to returns 400', async () => {
    const res = await req
      .post('/dashboard/ops/reports')
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({ type: 'REVENUE', from: '2026-12-31', to: '2026-01-01' });

    expect(res.status).toBe(400);
  });
});