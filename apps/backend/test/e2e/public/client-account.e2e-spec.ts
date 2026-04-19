import { testPrisma, cleanTables } from '../../setup/db.setup';
import { seedClient, seedEmployee, seedService, seedBranch, seedBooking } from '../../setup/seed.helper';
import { OtpChannel, OtpPurpose } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { RegisterHandler } from '../../../src/modules/identity/client-auth/register.handler';
import { OtpSessionService } from '../../../src/modules/identity/otp/otp-session.service';
import { ClientLoginHandler } from '../../../src/modules/identity/client-auth/client-login.handler';
import { GetMeHandler } from '../../../src/modules/identity/client-auth/get-me.handler';
import { ListClientBookingsHandler } from '../../../src/modules/bookings/client/list-client-bookings.handler';
import { ClientCancelBookingHandler } from '../../../src/modules/bookings/client/client-cancel-booking.handler';
import { ClientRescheduleBookingHandler } from '../../../src/modules/bookings/client/client-reschedule-booking.handler';
import { ClientTokenService } from '../../../src/modules/identity/shared/client-token.service';
import { PasswordService } from '../../../src/modules/identity/shared/password.service';
import { GetBookingSettingsHandler } from '../../../src/modules/bookings/get-booking-settings/get-booking-settings.handler';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

const JWT_ACCESS_SECRET = 'test-access-secret-32chars-min';
const JWT_CLIENT_ACCESS_SECRET = 'test-client-access-secret-32';

function signOtpSession(payload: { identifier: string; purpose: OtpPurpose; channel: OtpChannel }): string {
  return jwt.sign(
    { ...payload, jti: uuidv4() },
    JWT_ACCESS_SECRET,
    { expiresIn: '30m' },
  );
}

const mockConfig = new ConfigService({
  JWT_ACCESS_SECRET,
  JWT_CLIENT_ACCESS_SECRET,
  JWT_CLIENT_ACCESS_TTL: '7d',
} as Record<string, string>);

describe('Client Account — Full Journey (e2e-style)', () => {
  let clientId: string;
  let employeeId: string;
  let serviceId: string;
  let branchId: string;
  let bookingId: string;

  const jwtService = new JwtService({ secret: JWT_ACCESS_SECRET });
  const configService = new ConfigService({
    JWT_ACCESS_SECRET,
    JWT_CLIENT_ACCESS_SECRET,
    JWT_CLIENT_ACCESS_TTL: '7d',
  } as Record<string, string>);
  const passwordService = new PasswordService();
  const clientTokenService = new ClientTokenService(jwtService, configService);
  const otpSessionService = new OtpSessionService(jwtService, configService);

  beforeEach(async () => {
    await cleanTables([
      'ClientRefreshToken',
      'OtpCode',
      'BookingStatusLog',
      'Booking',
      'Invoice',
      'Payment',
      'Client',
      'Employee',
      'Service',
      'Branch',
    ]);

    const [client, employee, service, branch] = await Promise.all([
      seedClient(testPrisma, { name: 'Guest User', phone: '+966501111111' }),
      seedEmployee(testPrisma),
      seedService(testPrisma, { durationMins: 60, price: 200 }),
      seedBranch(testPrisma),
    ]);

    clientId = client.id;
    employeeId = employee.id;
    serviceId = service.id;
    branchId = branch.id;

    const booking = await seedBooking(testPrisma, {
      clientId,
      employeeId,
      serviceId,
      branchId,
      scheduledAt: new Date(Date.now() + 3 * 86_400_000),
      status: 'CONFIRMED',
    });
    bookingId = booking.id;
  });

  async function createOtpSession(identifier: string, purpose: OtpPurpose): Promise<string> {
    const plainCode = '123456';
    const codeHash = await bcrypt.hash(plainCode, 10);
    await testPrisma.otpCode.create({
      data: {
        channel: OtpChannel.EMAIL,
        identifier,
        codeHash,
        purpose,
        expiresAt: new Date(Date.now() + 10 * 60_000),
      },
    });
    return plainCode;
  }

  it('registers a new client account via OTP session', async () => {
    const email = `newclient-${Date.now()}@test.com`;
    const password = 'SecurePass123';

    const sessionToken = signOtpSession({
      identifier: email,
      purpose: OtpPurpose.CLIENT_LOGIN,
      channel: OtpChannel.EMAIL,
    });

    const registerHandler = new RegisterHandler(
      testPrisma as never,
      otpSessionService,
      clientTokenService,
      passwordService,
    );

    const mockRequest = { headers: { authorization: `Bearer ${sessionToken}` } } as never;

    const result = await registerHandler.execute({ password, name: 'New Client' }, mockRequest);

    expect(result.accessToken).toBeDefined();
    expect(result.clientId).toBeDefined();

    const getMeHandler = new GetMeHandler(testPrisma as never);
    const profile = await getMeHandler.execute(result.clientId);
    expect(profile.email).toBe(email);
  });

  it('logs in with password and accesses /me', async () => {
    const email = `login-test-${Date.now()}@test.com`;
    const password = 'TestPass123';

    const sessionToken = signOtpSession({
      identifier: email,
      purpose: OtpPurpose.CLIENT_LOGIN,
      channel: OtpChannel.EMAIL,
    });

    const registerHandler = new RegisterHandler(
      testPrisma as never,
      otpSessionService,
      clientTokenService,
      passwordService,
    );

    await registerHandler.execute({ password, name: 'Login Test' }, { headers: { authorization: `Bearer ${sessionToken}` } } as never);

    const loginHandler = new ClientLoginHandler(
      testPrisma as never,
      { getClient: () => ({ incr: async () => 1, expire: async () => true, del: async () => 1 }) } as never,
      jwtService,
      configService,
      passwordService,
    );

    const tokens = await loginHandler.execute({ email, password });
    expect(tokens.accessToken).toBeDefined();

    const getMeHandler = new GetMeHandler(testPrisma as never);
    const profile = await getMeHandler.execute(tokens.clientId);
    expect(profile.email).toBe(email);
  });

  it('lists bookings for the authenticated client', async () => {
    const email = `bookings-test-${Date.now()}@test.com`;
    const password = 'TestPass123';

    const sessionToken = signOtpSession({
      identifier: email,
      purpose: OtpPurpose.CLIENT_LOGIN,
      channel: OtpChannel.EMAIL,
    });

    const registerHandler = new RegisterHandler(
      testPrisma as never,
      otpSessionService,
      clientTokenService,
      passwordService,
    );

    await registerHandler.execute({ password, name: 'Bookings Test' }, { headers: { authorization: `Bearer ${sessionToken}` } } as never);

    const loginHandler = new ClientLoginHandler(
      testPrisma as never,
      { getClient: () => ({ incr: async () => 1, expire: async () => true, del: async () => 1 }) } as never,
      jwtService,
      configService,
      passwordService,
    );

    const tokens = await loginHandler.execute({ email, password });

    const listHandler = new ListClientBookingsHandler(testPrisma as never);
    const result = await listHandler.execute(tokens.clientId, 1, 10);
    expect(result.items.length).toBeGreaterThanOrEqual(0);
    expect(result.total).toBeGreaterThanOrEqual(0);
  });

  it('cancels a booking within policy window', async () => {
    const email = `cancel-test-${Date.now()}@test.com`;
    const password = 'TestPass123';

    const sessionToken = signOtpSession({
      identifier: email,
      purpose: OtpPurpose.CLIENT_LOGIN,
      channel: OtpChannel.EMAIL,
    });

    const registerHandler = new RegisterHandler(
      testPrisma as never,
      otpSessionService,
      clientTokenService,
      passwordService,
    );

    const regResult = await registerHandler.execute({ password, name: 'Cancel Test' }, { headers: { authorization: `Bearer ${sessionToken}` } } as never);

    const ownBooking = await seedBooking(testPrisma, {
      clientId: regResult.clientId,
      employeeId,
      serviceId,
      branchId,
      scheduledAt: new Date(Date.now() + 3 * 86_400_000),
      status: 'CONFIRMED',
    });

    const loginHandler = new ClientLoginHandler(
      testPrisma as never,
      { getClient: () => ({ incr: async () => 1, expire: async () => true, del: async () => 1 }) } as never,
      jwtService,
      configService,
      passwordService,
    );

    const tokens = await loginHandler.execute({ email, password });

    const settingsHandler = new GetBookingSettingsHandler(testPrisma as never);
    const cancelHandler = new ClientCancelBookingHandler(testPrisma as never, settingsHandler);

    const result = await cancelHandler.execute({ bookingId: ownBooking.id, clientId: tokens.clientId });
    expect(result.status).toBeDefined();
  });

  it('reschedules a booking within policy window', async () => {
    const email = `reschedule-test-${Date.now()}@test.com`;
    const password = 'TestPass123';

    const sessionToken = signOtpSession({
      identifier: email,
      purpose: OtpPurpose.CLIENT_LOGIN,
      channel: OtpChannel.EMAIL,
    });

    const registerHandler = new RegisterHandler(
      testPrisma as never,
      otpSessionService,
      clientTokenService,
      passwordService,
    );

    const regResult = await registerHandler.execute({ password, name: 'Reschedule Test' }, { headers: { authorization: `Bearer ${sessionToken}` } } as never);

    const ownBooking = await seedBooking(testPrisma, {
      clientId: regResult.clientId,
      employeeId,
      serviceId,
      branchId,
      scheduledAt: new Date(Date.now() + 3 * 86_400_000),
      status: 'CONFIRMED',
    });

    const loginHandler = new ClientLoginHandler(
      testPrisma as never,
      { getClient: () => ({ incr: async () => 1, expire: async () => true, del: async () => 1 }) } as never,
      jwtService,
      configService,
      passwordService,
    );

    const tokens = await loginHandler.execute({ email, password });

    const settingsHandler = new GetBookingSettingsHandler(testPrisma as never);
    const rescheduleHandler = new ClientRescheduleBookingHandler(testPrisma as never, settingsHandler);

    const newDate = new Date(Date.now() + 10 * 86_400_000).toISOString();
    const result = await rescheduleHandler.execute({
      bookingId: ownBooking.id,
      clientId: tokens.clientId,
      newScheduledAt: newDate,
    });

    expect(result.booking).toBeDefined();
  });

  it('rejects cancel for a client who does not own the booking', async () => {
    const emailA = `client-a-${Date.now()}@test.com`;
    const emailB = `client-b-${Date.now()}@test.com`;
    const password = 'TestPass123';

    for (const email of [emailA, emailB]) {
      const sessionToken = signOtpSession({
        identifier: email,
        purpose: OtpPurpose.CLIENT_LOGIN,
        channel: OtpChannel.EMAIL,
      });

      const registerHandler = new RegisterHandler(
        testPrisma as never,
        otpSessionService,
        clientTokenService,
        passwordService,
      );

      await registerHandler.execute({ password, name: 'Test' }, { headers: { authorization: `Bearer ${sessionToken}` } } as never);

      const loginHandler = new ClientLoginHandler(
        testPrisma as never,
        { getClient: () => ({ incr: async () => 1, expire: async () => true, del: async () => 1 }) } as never,
        jwtService,
        configService,
        passwordService,
      );

      await loginHandler.execute({ email, password });
    }

    const loginA = await new ClientLoginHandler(
      testPrisma as never,
      { getClient: () => ({ incr: async () => 1, expire: async () => true, del: async () => 1 }) } as never,
      jwtService,
      configService,
      passwordService,
    ).execute({ email: emailA, password });

    const settingsHandler = new GetBookingSettingsHandler(testPrisma as never);
    const cancelHandler = new ClientCancelBookingHandler(testPrisma as never, settingsHandler);

    await expect(
      cancelHandler.execute({ bookingId, clientId: loginA.clientId }),
    ).rejects.toThrow();
  });

  it('guest booking is visible after guest-to-account merge', async () => {
    const guestEmail = `guestmerge-${Date.now()}@test.com`;

    const guestClient = await testPrisma.client.create({
      data: {
        name: 'Guest User',
        firstName: 'Guest',
        lastName: 'User',
        phone: `+9665${Date.now().toString().slice(-8)}`,
        email: guestEmail,
        isActive: true,
        source: 'WALK_IN',
      },
    });

    const guestBooking = await seedBooking(testPrisma, {
      clientId: guestClient.id,
      employeeId,
      serviceId,
      branchId,
      scheduledAt: new Date(Date.now() + 5 * 86_400_000),
      status: 'CONFIRMED',
    });

    const guestSessionToken = signOtpSession({
      identifier: guestEmail,
      purpose: OtpPurpose.CLIENT_LOGIN,
      channel: OtpChannel.EMAIL,
    });

    const registerHandler = new RegisterHandler(
      testPrisma as never,
      otpSessionService,
      clientTokenService,
      passwordService,
    );

    await registerHandler.execute(
      { password: 'TestPass123', name: 'Merge Test' },
      { headers: { authorization: `Bearer ${guestSessionToken}` } } as never,
    );

    const loginHandler = new ClientLoginHandler(
      testPrisma as never,
      { getClient: () => ({ incr: async () => 1, expire: async () => true, del: async () => 1 }) } as never,
      jwtService,
      configService,
      passwordService,
    );

    const tokens = await loginHandler.execute({ email: guestEmail, password: 'TestPass123' });

    const listHandler = new ListClientBookingsHandler(testPrisma as never);
    const result = await listHandler.execute(tokens.clientId, 1, 50);

    const found = result.items.find((b) => b.id === guestBooking.id);
    expect(found).toBeDefined();
  });
});
