import SuperTest from 'supertest';
import * as bcrypt from 'bcryptjs';
import { PaymentStatus } from '@prisma/client';
import { testPrisma, cleanTables } from './setup/db.setup';
import { seedBranch, seedClient, seedEmployee, seedEmployeeService, seedService } from './setup/seed.helper';

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgresql://carekit:carekit_dev_password@127.0.0.1:5999/carekit_test?schema=public';

function configureE2eEnv(): void {
  process.env.TENANT_ENFORCEMENT ??= 'permissive';
  process.env.DEFAULT_ORGANIZATION_ID ??= '00000000-0000-0000-0000-000000000001';
  process.env.TEST_DATABASE_URL = TEST_DATABASE_URL;
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  process.env.REDIS_HOST = 'localhost';
  process.env.REDIS_PORT = '5380';
  process.env.OPENAI_API_KEY = 'test-key';
  process.env.OPENROUTER_API_KEY = 'test-key';
  process.env.MOYASAR_API_KEY = 'test-key';
  process.env.MOYASAR_SECRET_KEY = 'test-secret';
  process.env.FCM_PROJECT_ID = 'test-project';
  process.env.SMTP_HOST = 'localhost';
  process.env.SMTP_PORT = '1025';
  process.env.LICENSE_SERVER_URL = 'http://localhost:9999';
  process.env.MINIO_ENDPOINT = 'localhost';
  process.env.MINIO_PORT = '9000';
  process.env.MINIO_ACCESS_KEY = 'minioadmin';
  process.env.MINIO_SECRET_KEY = 'minioadmin123';
  process.env.MINIO_BUCKET = 'carekit';
  process.env.JWT_ACCESS_SECRET = 'test-access-secret-32chars-min';
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-32chars-min';
  process.env.JWT_ACCESS_TTL = '15m';
  process.env.JWT_REFRESH_TTL = '30d';
  process.env.JWT_CLIENT_ACCESS_SECRET = 'test-client-access-secret-32chars';
  process.env.JWT_CLIENT_REFRESH_SECRET = 'test-client-refresh-secret-32chars';
  process.env.JWT_CLIENT_ACCESS_TTL = '15m';
  process.env.JWT_CLIENT_REFRESH_TTL = '14d';
  process.env.SMS_PROVIDER_ENCRYPTION_KEY = Buffer.alloc(32, 1).toString('base64');
}

const CLEAN_TABLES = [
  'ClientRefreshToken',
  'PasswordHistory',
  'BookingStatusLog',
  'Payment',
  'Invoice',
  'Booking',
  'EmployeeService',
  'Employee',
  'Service',
  'Branch',
  'Client',
];

describe('POST /mobile/client/payments/init (e2e)', () => {
  let req: SuperTest.Agent;
  let accessToken: string;
  let branchId: string;
  let employeeId: string;
  let serviceId: string;
  let closeApp: (() => Promise<void>) | undefined;

  beforeAll(async () => {
    configureE2eEnv();
    const publicTestApp = await import('./e2e/public/public-test-app');
    closeApp = publicTestApp.closePublicTestApp;
    const app = await publicTestApp.createPublicTestApp();
    req = app.request;

    await cleanTables(CLEAN_TABLES);

    const password = 'SecurePass1';
    const email = `payment-init-${Date.now()}@test.com`;
    const passwordHash = await bcrypt.hash(password, 10);
    const [client, branch, employee, service] = await Promise.all([
      seedClient(testPrisma, { name: 'Payment Init Client' }),
      seedBranch(testPrisma),
      seedEmployee(testPrisma),
      seedService(testPrisma, { durationMins: 60, price: 200 }),
    ]);

    await Promise.all([
      testPrisma.client.update({
        where: { id: client.id },
        data: {
          email,
          passwordHash,
          source: 'ONLINE',
          accountType: 'FULL',
        },
      }),
      seedEmployeeService(testPrisma, employee.id, service.id),
    ]);

    const loginRes = await req.post('/public/auth/login').send({ email, password });
    expect(loginRes.status).toBe(200);
    accessToken = loginRes.body.accessToken as string;
    branchId = branch.id;
    employeeId = employee.id;
    serviceId = service.id;
  });

  afterAll(async () => {
    await cleanTables(CLEAN_TABLES);
    if (closeApp) {
      await closeApp();
    }
  });

  it('creates a booking invoice and initializes a pending Moyasar payment', async () => {
    const bookingRes = await req
      .post('/mobile/client/bookings')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        branchId,
        employeeId,
        serviceId,
        scheduledAt: new Date(Date.now() + 86_400_000).toISOString(),
      });

    expect(bookingRes.status).toBe(201);
    expect(bookingRes.body).toHaveProperty('invoiceId');
    expect(typeof bookingRes.body.invoiceId).toBe('string');

    const invoiceId = bookingRes.body.invoiceId as string;
    const initRes = await req
      .post('/mobile/client/payments/init')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ invoiceId, method: 'ONLINE_CARD' });

    expect(initRes.status).toBe(201);
    expect(typeof initRes.body.paymentId).toBe('string');
    expect(typeof initRes.body.redirectUrl).toBe('string');

    const payment = await testPrisma.payment.findUnique({
      where: { id: initRes.body.paymentId as string },
    });
    expect(payment).not.toBeNull();
    expect(payment!.invoiceId).toBe(invoiceId);
    expect(payment!.status).toBe(PaymentStatus.PENDING);
  });
});
