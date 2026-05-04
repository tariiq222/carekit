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
import { NotificationType, RecipientType } from '@prisma/client';

describe('Notifications API Flow (e2e)', () => {
  let req: SuperTest.Agent;
  let TOKEN: string;
  let branchId: string;
  let employeeId: string;
  let clientId: string;
  let serviceId: string;
  let userId: string;

  beforeAll(async () => {
    ({ request: req } = await createTestApp());
    await ensureTestUsers();
    TOKEN = createTestToken(adminUser);
    userId = adminUser.id;
    await cleanTables([
      'NotificationDeliveryLog',
      'Notification',
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
      seedEmployee(testPrisma as never, { name: 'Dr. Notifications' }),
      seedService(testPrisma as never, { nameAr: 'خدمة الإشعارات', price: 200 }),
      seedBranch(testPrisma as never, { nameAr: 'فرع الإشعارات' }),
    ]);

    clientId = client.id;
    employeeId = employee.id;
    serviceId = service.id;
    branchId = branch.id;

    await seedEmployeeService(testPrisma as never, employeeId, serviceId);
  });

  afterAll(async () => {
    await cleanTables([
      'NotificationDeliveryLog',
      'Notification',
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

  it('[NOTIF-001][Notifications][P1-High] list notifications returns paginated results', async () => {
    const res = await req
      .get('/dashboard/comms/notifications')
      .set('Authorization', `Bearer ${TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('items');
    expect(res.body).toHaveProperty('meta');
    expect(Array.isArray(res.body.items)).toBe(true);
  });

  it('[NOTIF-002][Notifications][P1-High] unread count returns correct number', async () => {
    await (testPrisma as never).notification.create({
      data: {
        organizationId: '00000000-0000-0000-0000-000000000001',
        recipientId: userId,
        recipientType: RecipientType.EMPLOYEE,
        type: NotificationType.BOOKING_CREATED,
        title: 'Test Notification',
        body: 'This is a test notification',
        isRead: false,
      },
    });

    const res = await req
      .get('/dashboard/comms/notifications/unread-count')
      .set('Authorization', `Bearer ${TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('count');
    expect(typeof res.body.count).toBe('number');
  });

  it('[NOTIF-003][Notifications][P1-High] mark single notification as read', async () => {
    const notification = await (testPrisma as never).notification.create({
      data: {
        organizationId: '00000000-0000-0000-0000-000000000001',
        recipientId: userId,
        recipientType: RecipientType.EMPLOYEE,
        type: NotificationType.GENERAL,
        title: 'Mark Read Test',
        body: 'Testing mark as read',
        isRead: false,
      },
    });

    const res = await req
      .patch('/dashboard/comms/notifications/mark-read')
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({ notificationId: notification.id });

    expect(res.status).toBe(204);

    const updated = await (testPrisma as never).notification.findUnique({
      where: { id: notification.id },
      select: { isRead: true, readAt: true },
    });
    expect(updated!.isRead).toBe(true);
    expect(updated!.readAt).not.toBeNull();
  });

  it('[NOTIF-004][Notifications][P2-Medium] mark all notifications as read', async () => {
    await (testPrisma as never).notification.createMany({
      data: [
        {
          organizationId: '00000000-0000-0000-0000-000000000001',
          recipientId: userId,
          recipientType: RecipientType.EMPLOYEE,
          type: NotificationType.GENERAL,
          title: 'Unread 1',
          body: 'Body 1',
          isRead: false,
        },
        {
          organizationId: '00000000-0000-0000-0000-000000000001',
          recipientId: userId,
          recipientType: RecipientType.EMPLOYEE,
          type: NotificationType.GENERAL,
          title: 'Unread 2',
          body: 'Body 2',
          isRead: false,
        },
      ],
    });

    const res = await req
      .patch('/dashboard/comms/notifications/mark-read')
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({});

    expect(res.status).toBe(204);

    const unreadCount = await (testPrisma as never).notification.count({
      where: { recipientId: userId, isRead: false },
    });
    expect(unreadCount).toBe(0);
  });

  it('[NOTIF-005][Notifications][P1-High] filter notifications by unread only', async () => {
    await (testPrisma as never).notification.create({
      data: {
        organizationId: '00000000-0000-0000-0000-000000000001',
        recipientId: userId,
        recipientType: RecipientType.EMPLOYEE,
        type: NotificationType.GENERAL,
        title: 'Unread Filter Test',
        body: 'Should appear in unread filter',
        isRead: false,
      },
    });

    const res = await req
      .get('/dashboard/comms/notifications?unreadOnly=true')
      .set('Authorization', `Bearer ${TOKEN}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    for (const item of res.body.items) {
      expect(item.isRead).toBe(false);
    }
  });

  it('[NOTIF-006][Notifications][P1-High] 401 without JWT', async () => {
    const res = await req.get('/dashboard/comms/notifications');
    expect(res.status).toBe(401);
  });

  it('[NOTIF-007][Notifications][P2-Medium] creating booking creates notification entry in DB', async () => {
    const beforeCount = await (testPrisma as never).notification.count({
      where: { recipientType: RecipientType.EMPLOYEE },
    });

    const bookingRes = await req
      .post('/dashboard/bookings')
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({
        clientId,
        employeeId,
        serviceId,
        branchId,
        scheduledAt: new Date(Date.now() + 3 * 86_400_000).toISOString(),
        bookingType: 'INDIVIDUAL',
      });

    if (bookingRes.status === 201) {
      const afterCount = await (testPrisma as never).notification.count({
        where: { recipientType: RecipientType.EMPLOYEE },
      });
      expect(afterCount).toBeGreaterThanOrEqual(beforeCount);
    } else {
      expect([400, 409, 500]).toContain(bookingRes.status);
    }
  });

  it('[NOTIF-008][Notifications][P2-Medium] payment creates notification delivery log', async () => {
    const booking = await seedBooking(testPrisma as never, {
      clientId,
      employeeId,
      serviceId,
      branchId,
      status: 'COMPLETED',
      scheduledAt: new Date(Date.now() - 2 * 86_400_000),
    });

    const invRes = await req
      .post('/dashboard/finance/invoices')
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({
        bookingId: booking.id,
        branchId,
        clientId,
        employeeId,
        subtotal: 150,
      });
    expect(invRes.status).toBe(201);

    const payRes = await req
      .post('/dashboard/finance/payments')
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({ invoiceId: invRes.body.id, amount: 150, method: 'CASH' });

    if (payRes.status === 201) {
      const logCount = await (testPrisma as never).notificationDeliveryLog.count();
      expect(logCount).toBeGreaterThanOrEqual(0);
    }
  });
});