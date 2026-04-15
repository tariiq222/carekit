import SuperTest from 'supertest';
import { createTestApp, closeTestApp } from '../../setup/app.setup';
import { testPrisma, cleanTables } from '../../setup/db.setup';
import { createTestToken, adminUser, TEST_TENANT_ID } from '../../setup/auth.helper';

// Enum values verified from comms.prisma: RecipientType.EMPLOYEE, NotificationType.BOOKING_REMINDER
const TENANT = TEST_TENANT_ID;
const RECIPIENT = adminUser.id;

async function seedNotification(overrides: Partial<{ title: string; body: string; isRead: boolean }> = {}) {
  return (testPrisma as any).notification.create({
    data: {
      tenantId: TENANT,
      recipientId: RECIPIENT,
      recipientType: 'EMPLOYEE',
      type: 'BOOKING_REMINDER',
      title: overrides.title ?? 'Test notification',
      body: overrides.body ?? 'Body text',
      isRead: overrides.isRead ?? false,
    },
  });
}

describe('Notifications realtime API (e2e)', () => {
  let req: SuperTest.Agent;
  let TOKEN: string;

  beforeAll(async () => {
    ({ request: req } = await createTestApp());
    TOKEN = createTestToken(adminUser);
  });

  beforeEach(async () => {
    await cleanTables(['Notification']);
  });

  afterAll(async () => {
    await cleanTables(['Notification']);
    await closeTestApp();
  });

  it('[NT-001][Notifications/list-notifications][P1-High] Create notification يظهر في list', async () => {
    await seedNotification({ title: 'إشعار جديد' });

    const res = await req
      .get('/dashboard/comms/notifications')
      .set('x-tenant-id', TENANT)
      .set('Authorization', `Bearer ${TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].title).toBe('إشعار جديد');
    expect(res.body.items[0].isRead).toBe(false);
  });

  it('[NT-002][Notifications/get-unread-count][P1-High] get-unread-count يعكس الحالة', async () => {
    await seedNotification();
    await seedNotification();
    await seedNotification({ isRead: true });

    const res = await req
      .get('/dashboard/comms/notifications/unread-count')
      .set('x-tenant-id', TENANT)
      .set('Authorization', `Bearer ${TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(2);
  });

  it('[NT-003][Notifications/mark-read][P1-High] mark-read يخفّض العداد', async () => {
    const n1 = await seedNotification();
    await seedNotification();

    const res = await req
      .patch('/dashboard/comms/notifications/mark-read')
      .set('x-tenant-id', TENANT)
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({ notificationId: n1.id });

    expect(res.status).toBe(204);

    const countRes = await req
      .get('/dashboard/comms/notifications/unread-count')
      .set('x-tenant-id', TENANT)
      .set('Authorization', `Bearer ${TOKEN}`);
    expect(countRes.body.count).toBe(1);

    const inDb = await (testPrisma as any).notification.findUnique({ where: { id: n1.id } });
    expect(inDb.isRead).toBe(true);
    expect(inDb.readAt).not.toBeNull();
  });

  it('[NT-004][Notifications/mark-read][P2-Medium] mark-all-read (بدون notificationId) يصفّر العداد', async () => {
    await seedNotification();
    await seedNotification();
    await seedNotification();

    const res = await req
      .patch('/dashboard/comms/notifications/mark-read')
      .set('x-tenant-id', TENANT)
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({});

    expect(res.status).toBe(204);

    const countRes = await req
      .get('/dashboard/comms/notifications/unread-count')
      .set('x-tenant-id', TENANT)
      .set('Authorization', `Bearer ${TOKEN}`);
    expect(countRes.body.count).toBe(0);
  });
});
