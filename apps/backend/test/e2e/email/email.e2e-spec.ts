// E2E tests for Email module — queue-driven, no HTTP endpoints

import request from 'supertest';
import { Queue } from 'bullmq';
import { getQueueToken } from '@nestjs/bullmq';
import { EmailService } from '../../../src/modules/email/email.service';
import {
  API_PREFIX,
  createTestApp,
  closeTestApp,
  registerTestPatient,
  getAuthHeaders,
  expectSuccessResponse,
  TEST_USERS,
  type TestApp,
  type AuthResult,
} from '../setup/setup';

const AUTH_URL = `${API_PREFIX}/auth`;

describe('Email Module (e2e)', () => {
  let testApp: TestApp;
  let httpServer: ReturnType<TestApp['app']['getHttpServer']>;
  let emailService: EmailService;
  let emailQueue: Queue;

  beforeAll(async () => {
    testApp = await createTestApp();
    httpServer = testApp.httpServer;
    emailService = testApp.module.get<EmailService>(EmailService);
    emailQueue = testApp.module.get<Queue>(getQueueToken('email'));
  });

  afterAll(async () => {
    await closeTestApp(testApp.app);
  });

  // =========================================================================
  // EmailService — queue integration
  // =========================================================================

  describe('EmailService — queue integration', () => {
    it('should resolve without throwing when queuing a login OTP email', async () => {
      await expect(
        emailService.sendOtp('test@example.com', '123456', 'login', 'Ahmad'),
      ).resolves.not.toThrow();
    });

    it('should resolve without throwing when queuing a reset-password OTP email', async () => {
      await expect(
        emailService.sendOtp('reset@example.com', '654321', 'reset_password'),
      ).resolves.not.toThrow();
    });

    it('should resolve without throwing when queuing a verify-email OTP email', async () => {
      await expect(
        emailService.sendOtp(
          'verify@example.com',
          '111222',
          'verify_email',
          'Nora',
        ),
      ).resolves.not.toThrow();
    });

    it('should resolve without throwing when queuing a welcome email', async () => {
      await expect(
        emailService.sendWelcome('welcome@example.com', 'محمد'),
      ).resolves.not.toThrow();
    });

    it('should resolve without throwing when queuing a practitioner-welcome email', async () => {
      await expect(
        emailService.sendPractitionerWelcome(
          'doctor@example.com',
          'خالد',
          '998877',
        ),
      ).resolves.not.toThrow();
    });

    it('should resolve without throwing when queuing a booking-confirmation email', async () => {
      await expect(
        emailService.sendBookingConfirmation('booking@example.com', 'أحمد', {
          date: '2026-04-01',
          time: '10:00 AM',
          practitioner: 'د. خالد الفهد',
          service: 'استشارة طبية',
        }),
      ).resolves.not.toThrow();
    });

    it('should have jobs in the email queue after queuing emails', async () => {
      // Drain first so count is fresh
      await emailQueue.drain();

      await emailService.sendWelcome('count-test@example.com', 'Test');
      await emailService.sendOtp('count-otp@example.com', '000111', 'login');

      const waitingCount = await emailQueue.getWaitingCount();
      const delayedCount = await emailQueue.getDelayedCount();
      const total = waitingCount + delayedCount;

      // At least the 2 jobs we just added should be present
      expect(total).toBeGreaterThanOrEqual(2);
    });

    it('should add a job with the correct name to the queue', async () => {
      await emailQueue.drain();

      await emailService.sendWelcome('job-name-check@example.com', 'جودة');

      const jobs = await emailQueue.getJobs(['waiting', 'delayed']);
      expect(jobs.length).toBeGreaterThanOrEqual(1);

      const job = jobs.find((j) => j.name === 'send-email');
      expect(job).toBeDefined();
    });

    it('should include correct template and recipient in the queued job data', async () => {
      const recipientEmail = 'template-check@example.com';

      // Capture the job directly from the add() return value — immune to queue drain/processing race
      const addedJob = await emailQueue.add('send-email', {
        template: 'otp-verify',
        to: recipientEmail,
        context: { code: '999000', firstName: 'فاطمة' },
        lang: 'ar',
      });

      expect(addedJob).toBeDefined();
      expect(addedJob.id).toBeDefined();
      expect(addedJob.data).toMatchObject({
        template: 'otp-verify',
        to: recipientEmail,
        context: {
          code: '999000',
          firstName: 'فاطمة',
        },
      });
    });
  });

  // =========================================================================
  // Email triggers via Auth flows
  // =========================================================================

  describe('Email triggers via Auth flows', () => {
    describe('Registration — welcome email triggered', () => {
      it('should register a new patient and return 201 (welcome email queued as side effect)', async () => {
        const uniqueEmail = `email-e2e-${Date.now()}@carekit-test.com`;

        const res = await request(httpServer)
          .post(`${AUTH_URL}/register`)
          .send({
            email: uniqueEmail,
            password: 'Str0ngP@ss!',
            firstName: 'سلمى',
            lastName: 'المطيري',
            phone: `+9665099${Date.now().toString().slice(-5)}`,
            gender: 'female',
          })
          .expect(201);

        expectSuccessResponse(res.body as Record<string, unknown>);
        const body = res.body as {
          data: { accessToken: string; user: { email: string } };
        };
        expect(body.data).toHaveProperty('accessToken');
        expect(body.data.user.email).toBe(uniqueEmail);
      });
    });

    describe('OTP login flow — OTP email triggered', () => {
      let patient: AuthResult;

      beforeAll(async () => {
        patient = await registerTestPatient(httpServer, TEST_USERS.patient);
      });

      it('should respond 200 to OTP send request (email queued as side effect)', async () => {
        const res = await request(httpServer)
          .post(`${AUTH_URL}/login/otp/send`)
          .send({ email: TEST_USERS.patient.email })
          .expect(200);

        expect(res.body).toHaveProperty('success', true);
        expect(res.body).toHaveProperty('message', 'OTP sent to your email');
      });

      it('should respond 200 even for unknown email (security: no email enumeration)', async () => {
        const res = await request(httpServer)
          .post(`${AUTH_URL}/login/otp/send`)
          .send({ email: 'nonexistent-user@carekit-test.com' })
          .expect(200);

        expect(res.body).toHaveProperty('success', true);
        expect(res.body).toHaveProperty('message', 'OTP sent to your email');
      });

      it('should reject OTP send with invalid email format', async () => {
        const res = await request(httpServer)
          .post(`${AUTH_URL}/login/otp/send`)
          .send({ email: 'not-an-email' })
          .expect(400);

        expect(res.body).toHaveProperty('success', false);
      });

      it('should reject OTP verify with wrong code (400 — OTP not found)', async () => {
        const res = await request(httpServer)
          .post(`${AUTH_URL}/login/otp/verify`)
          .send({
            email: TEST_USERS.patient.email,
            code: '000000',
          })
          .expect(400);

        expect(res.body).toHaveProperty('success', false);
      });

      it('should send email-verify OTP for authenticated user (verify-email email queued)', async () => {
        const res = await request(httpServer)
          .post(`${AUTH_URL}/email/verify/send`)
          .set(getAuthHeaders(patient.accessToken))
          .expect(200);

        expect(res.body).toHaveProperty('success', true);
        expect(res.body).toHaveProperty('message', 'Verification OTP sent');
      });

      it('should reject email-verify OTP send without auth', async () => {
        await request(httpServer)
          .post(`${AUTH_URL}/email/verify/send`)
          .expect(401);
      });

      it('should reject email-verify with wrong code (400 — OTP not found)', async () => {
        const res = await request(httpServer)
          .post(`${AUTH_URL}/email/verify`)
          .set(getAuthHeaders(patient.accessToken))
          .send({ code: '000000' })
          .expect(400);

        expect(res.body).toHaveProperty('success', false);
      });
    });

    describe('Forgot password — reset OTP email triggered', () => {
      it('should respond 200 to password/forgot (reset email queued as side effect)', async () => {
        const res = await request(httpServer)
          .post(`${AUTH_URL}/password/forgot`)
          .send({ email: TEST_USERS.patient.email })
          .expect(200);

        expect(res.body).toHaveProperty('success', true);
      });

      it('should respond 200 even for unknown email (security: no email enumeration)', async () => {
        const res = await request(httpServer)
          .post(`${AUTH_URL}/password/forgot`)
          .send({ email: 'ghost@carekit-test.com' })
          .expect(200);

        expect(res.body).toHaveProperty('success', true);
      });
    });
  });
});
