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
import { createTestToken, adminUser } from '../../setup/auth.helper';

describe('Booking Availability API (e2e)', () => {
  let req: SuperTest.Agent;
  let TOKEN: string;
  let employeeId: string;
  let serviceId: string;
  let branchId: string;

  beforeAll(async () => {
    ({ request: req } = await createTestApp());
    TOKEN = createTestToken(adminUser);
    await cleanTables([
      'Booking',
      'Invoice',
      'Client',
      'Employee',
      'Service',
      'Branch',
      'EmployeeAvailability',
    ]);

    const [employee, service, branch] = await Promise.all([
      seedEmployee(testPrisma as never, { name: 'Dr. Availability' }),
      seedService(testPrisma as never, { nameAr: 'استشارة', durationMins: 60, price: 300 }),
      seedBranch(testPrisma as never, { nameAr: 'فرع الاختبار' }),
    ]);

    employeeId = employee.id;
    serviceId = service.id;
    branchId = branch.id;

    await seedEmployeeService(testPrisma as never, employeeId, serviceId);
    await seedEmployeeAvailability(testPrisma as never, employeeId, {
      startTime: '09:00',
      endTime: '17:00',
    });
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
    ]);
    await closeTestApp();
  });

  it('[AVAIL-001][Availability][P1-High] returns slots within employee availability window', async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);

    const res = await req
      .get('/dashboard/bookings/availability')
      .set('Authorization', `Bearer ${TOKEN}`)
      .query({
        employeeId,
        branchId,
        date: tomorrow.toISOString().split('T')[0],
        serviceId,
      });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);

    const slot = res.body[0];
    expect(slot).toHaveProperty('startTime');
    expect(slot).toHaveProperty('endTime');
  });

  it('[AVAIL-002][Availability][P1-High] excludes slots that overlap with existing bookings', async () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 2);
    futureDate.setHours(10, 0, 0, 0);

    const dateStr = futureDate.toISOString().split('T')[0];

    const resAll = await req
      .get('/dashboard/bookings/availability')
      .set('Authorization', `Bearer ${TOKEN}`)
      .query({ employeeId, branchId, date: dateStr, serviceId });

    expect(resAll.status).toBe(200);
    const initialSlots = resAll.body.length;

    const bookingRes = await req
      .post('/dashboard/bookings')
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({
        clientId: (await seedClient(testPrisma as never)).id,
        employeeId,
        serviceId,
        branchId,
        scheduledAt: futureDate.toISOString(),
        bookingType: 'INDIVIDUAL',
      });
    expect(bookingRes.status).toBe(201);

    const resAfter = await req
      .get('/dashboard/bookings/availability')
      .set('Authorization', `Bearer ${TOKEN}`)
      .query({ employeeId, branchId, date: dateStr, serviceId });

    expect(resAfter.status).toBe(200);
    expect(resAfter.body.length).toBeLessThan(initialSlots);
  });

  it('[AVAIL-003][Availability][P2-Medium] returns empty array for date with no availability', async () => {
    const pastDate = '2020-01-01';

    const res = await req
      .get('/dashboard/bookings/availability')
      .set('Authorization', `Bearer ${TOKEN}`)
      .query({ employeeId, branchId, date: pastDate, serviceId });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(0);
  });

  it('[AVAIL-004][Availability][P1-High] 401 without JWT', async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const res = await req
      .get('/dashboard/bookings/availability')
      .query({
        employeeId,
        branchId,
        date: tomorrow.toISOString().split('T')[0],
        serviceId,
      });

    expect(res.status).toBe(401);
  });

  it('[AVAIL-005][Availability][P2-Medium] respects durationMins parameter', async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 3);
    tomorrow.setHours(12, 0, 0, 0);

    const dateStr = tomorrow.toISOString().split('T')[0];

    const res30 = await req
      .get('/dashboard/bookings/availability')
      .set('Authorization', `Bearer ${TOKEN}`)
      .query({ employeeId, branchId, date: dateStr, serviceId, durationMins: 30 });

    const res60 = await req
      .get('/dashboard/bookings/availability')
      .set('Authorization', `Bearer ${TOKEN}`)
      .query({ employeeId, branchId, date: dateStr, serviceId, durationMins: 60 });

    expect(res30.status).toBe(200);
    expect(res60.status).toBe(200);
    expect(res30.body.length).toBeGreaterThanOrEqual(res60.body.length);
  });
});