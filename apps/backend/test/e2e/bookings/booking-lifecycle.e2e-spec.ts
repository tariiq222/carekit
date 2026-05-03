import SuperTest from 'supertest';
import { createTestApp, closeTestApp } from '../../setup/app.setup';
import { testPrisma, cleanTables } from '../../setup/db.setup';
import { seedClient, seedEmployee, seedService, seedBranch, seedBooking, seedEmployeeService, seedEmployeeAvailability } from '../../setup/seed.helper';
import { createTestToken, adminUser, ensureTestUsers } from '../../setup/auth.helper';describe('Booking Lifecycle (e2e)', () => {
  let req: SuperTest.Agent;
  let clientId: string;
  let employeeId: string;
  let serviceId: string;
  let branchId: string;
  let TOKEN: string;

  beforeAll(async () => {
    ({ request: req } = await createTestApp());
    await ensureTestUsers();
    TOKEN = createTestToken(adminUser);
    await cleanTables(['BookingStatusLog', 'Booking', 'Client', 'Employee', 'Service', 'Branch', 'EmployeeService']);

    const [client, employee, service, branch] = await Promise.all([
      seedClient(testPrisma as any),
      seedEmployee(testPrisma as any),
      seedService(testPrisma as any),
      seedBranch(testPrisma as any),
    ]);
    clientId = client.id;
    employeeId = employee.id;
    serviceId = service.id;
    branchId = branch.id;

    await seedEmployeeService(testPrisma as any, employeeId, serviceId);
    await seedEmployeeAvailability(testPrisma as any, employeeId);
  });

  afterEach(async () => {
    // Clean bookings between tests to avoid booking_employee_no_overlap constraint
    // violations when multiple tests seed bookings for the same employee/time slot.
    await cleanTables(['BookingStatusLog', 'Booking']);
  });

  afterAll(async () => {
    await cleanTables(['BookingStatusLog', 'Booking', 'Client', 'Employee', 'Service', 'Branch', 'EmployeeService']);
    await closeTestApp();
  });

  it('✅ PENDING → CONFIRMED', async () => {
    const booking = await seedBooking(testPrisma as any, {
      clientId, employeeId, serviceId, branchId, status: 'PENDING',
    });

    const res = await req
      .patch(`/dashboard/bookings/${booking.id}/confirm`)
      .set('Authorization', `Bearer ${TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('CONFIRMED');

    const inDb = await (testPrisma as any).booking.findUnique({ where: { id: booking.id } });
    expect(inDb.status).toBe('CONFIRMED');
  });

  it('✅ CONFIRMED → COMPLETED', async () => {
    const booking = await seedBooking(testPrisma as any, {
      clientId, employeeId, serviceId, branchId, status: 'CONFIRMED',
    });

    const res = await req
      .patch(`/dashboard/bookings/${booking.id}/complete`)
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({ completionNotes: 'Done' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('COMPLETED');
  });

  it('✅ PENDING → CANCELLED', async () => {
    const booking = await seedBooking(testPrisma as any, {
      clientId, employeeId, serviceId, branchId, status: 'PENDING',
    });

    const res = await req
      .patch(`/dashboard/bookings/${booking.id}/cancel`)
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({ reason: 'CLIENT_REQUESTED' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('CANCELLED');
  });

  it('✅ CONFIRMED → NO_SHOW', async () => {
    const booking = await seedBooking(testPrisma as any, {
      clientId, employeeId, serviceId, branchId, status: 'CONFIRMED',
    });

    const res = await req
      .patch(`/dashboard/bookings/${booking.id}/no-show`)
      .set('Authorization', `Bearer ${TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('NO_SHOW');
  });

  it('❌ confirm على حجز CANCELLED → 400 أو 409', async () => {
    const booking = await seedBooking(testPrisma as any, {
      clientId, employeeId, serviceId, branchId, status: 'CANCELLED',
    });

    const res = await req
      .patch(`/dashboard/bookings/${booking.id}/confirm`)
      .set('Authorization', `Bearer ${TOKEN}`);

    expect([400, 409]).toContain(res.status);
  });

  it('❌ ID غير موجود → 404', async () => {
    const res = await req
      .patch('/dashboard/bookings/00000000-0000-0000-0000-000000000000/confirm')
      .set('Authorization', `Bearer ${TOKEN}`);

    expect(res.status).toBe(404);
  });
});