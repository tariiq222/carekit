/**
 * CareKit — EmailService Unit Tests
 *
 * Tests the EmailService business logic in isolation:
 *   - sendOtp — enqueues email job with correct template/subject for each type
 *   - sendWelcome — enqueues email job with 'welcome' template
 *   - sendBookingConfirmation — enqueues email job with booking details
 *   - Job data structure validation (to, subject, template, context)
 *
 * The BullMQ queue is mocked so tests run without Redis.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { EmailService } from '../../../src/modules/email/email.service.js';

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

const mockQueue = {
  add: jest.fn().mockResolvedValue({ id: 'job-1' }),
};

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const testEmail = 'patient@carekit.test';
const testFirstName = 'Ahmad';
const testOtpCode = '482917';

const testBookingDetails = {
  date: '2026-04-01',
  time: '09:00',
  practitioner: 'Dr. Khalid Al-Fahad',
  service: 'General Checkup',
};

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('EmailService', () => {
  let service: EmailService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        { provide: getQueueToken('email'), useValue: mockQueue },
      ],
    }).compile();

    service = module.get<EmailService>(EmailService);

    jest.clearAllMocks();
  });

  // ─────────────────────────────────────────────────────────────
  // sendOtp
  // ─────────────────────────────────────────────────────────────

  describe('sendOtp', () => {
    it('should enqueue login OTP email with correct template and subject', async () => {
      await service.sendOtp(testEmail, testOtpCode, 'login', testFirstName);

      expect(mockQueue.add).toHaveBeenCalledWith('send-email', expect.objectContaining({
        template: 'otp-login',
        to: testEmail,
        subject: 'Your Login Code | رمز تسجيل الدخول',
        context: { code: testOtpCode, firstName: testFirstName },
      }));
    });

    it('should enqueue reset_password OTP email with correct template and subject', async () => {
      await service.sendOtp(
        testEmail,
        testOtpCode,
        'reset_password',
        testFirstName,
      );

      expect(mockQueue.add).toHaveBeenCalledWith('send-email', expect.objectContaining({
        template: 'otp-reset',
        to: testEmail,
        subject: 'Password Reset Code | رمز إعادة تعيين كلمة المرور',
        context: { code: testOtpCode, firstName: testFirstName },
      }));
    });

    it('should enqueue verify_email OTP email with correct template and subject', async () => {
      await service.sendOtp(
        testEmail,
        testOtpCode,
        'verify_email',
        testFirstName,
      );

      expect(mockQueue.add).toHaveBeenCalledWith('send-email', expect.objectContaining({
        template: 'otp-verify',
        to: testEmail,
        subject: 'Email Verification Code | رمز تأكيد البريد الإلكتروني',
        context: { code: testOtpCode, firstName: testFirstName },
      }));
    });

    it('should default firstName to empty string when not provided', async () => {
      await service.sendOtp(testEmail, testOtpCode, 'login');

      expect(mockQueue.add).toHaveBeenCalledWith(
        'send-email',
        expect.objectContaining({
          context: { code: testOtpCode, firstName: '' },
        }),
      );
    });

    it('should include required job fields: to, subject, template, context', async () => {
      await service.sendOtp(testEmail, testOtpCode, 'login', testFirstName);

      const jobData = mockQueue.add.mock.calls[0][1];
      expect(jobData).toHaveProperty('to');
      expect(jobData).toHaveProperty('subject');
      expect(jobData).toHaveProperty('template');
      expect(jobData).toHaveProperty('context');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // sendWelcome
  // ─────────────────────────────────────────────────────────────

  describe('sendWelcome', () => {
    it('should enqueue welcome email with correct template', async () => {
      await service.sendWelcome(testEmail, testFirstName);

      expect(mockQueue.add).toHaveBeenCalledWith('send-email', expect.objectContaining({
        template: 'welcome',
        to: testEmail,
        subject: 'Welcome to CareKit | أهلا بك في كيركت',
        context: { firstName: testFirstName },
      }));
    });

    it('should use the correct recipient email', async () => {
      const customEmail = 'new-user@example.com';
      await service.sendWelcome(customEmail, 'Sara');

      expect(mockQueue.add).toHaveBeenCalledWith(
        'send-email',
        expect.objectContaining({ to: customEmail }),
      );
    });
  });

  // ─────────────────────────────────────────────────────────────
  // sendBookingConfirmation
  // ─────────────────────────────────────────────────────────────

  describe('sendBookingConfirmation', () => {
    it('should enqueue booking-confirmation email with all booking details', async () => {
      await service.sendBookingConfirmation(
        testEmail,
        testFirstName,
        testBookingDetails,
      );

      expect(mockQueue.add).toHaveBeenCalledWith('send-email', expect.objectContaining({
        template: 'booking-confirmation',
        to: testEmail,
        subject: 'Booking Confirmed | تأكيد الحجز',
        context: {
          firstName: testFirstName,
          date: testBookingDetails.date,
          time: testBookingDetails.time,
          practitioner: testBookingDetails.practitioner,
          service: testBookingDetails.service,
        },
      }));
    });

    it('should include booking date and time in context', async () => {
      await service.sendBookingConfirmation(
        testEmail,
        testFirstName,
        testBookingDetails,
      );

      const jobData = mockQueue.add.mock.calls[0][1];
      expect(jobData.context.date).toBe('2026-04-01');
      expect(jobData.context.time).toBe('09:00');
    });

    it('should include practitioner and service in context', async () => {
      await service.sendBookingConfirmation(
        testEmail,
        testFirstName,
        testBookingDetails,
      );

      const jobData = mockQueue.add.mock.calls[0][1];
      expect(jobData.context.practitioner).toBe('Dr. Khalid Al-Fahad');
      expect(jobData.context.service).toBe('General Checkup');
    });
  });
});
