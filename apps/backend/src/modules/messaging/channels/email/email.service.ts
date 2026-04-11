import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { correlationStorage } from '../../../../common/middleware/correlation-id.middleware.js';

interface BookingDetails {
  date: string;
  time: string;
  practitioner: string;
  service: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(@InjectQueue('email') private readonly emailQueue: Queue) {}

  async sendOtp(
    email: string,
    code: string,
    type: 'login' | 'reset_password' | 'verify_email',
    firstName?: string,
  ): Promise<void> {
    const templateMap: Record<string, { template: string; subject: string }> = {
      login: {
        template: 'otp-login',
        subject: 'Your Login Code | رمز تسجيل الدخول',
      },
      reset_password: {
        template: 'otp-reset',
        subject: 'Password Reset Code | رمز إعادة تعيين كلمة المرور',
      },
      verify_email: {
        template: 'otp-verify',
        subject: 'Email Verification Code | رمز تأكيد البريد الإلكتروني',
      },
    };

    const { template, subject } = templateMap[type];

    await this.emailQueue.add('send-email', {
      template,
      to: email,
      subject,
      context: { code, firstName: firstName ?? '' },
      correlationId: correlationStorage.getStore() ?? null,
    });

    this.logger.log(`Queued ${template} email to ${email}`);
  }

  async sendWelcome(email: string, firstName: string): Promise<void> {
    await this.emailQueue.add('send-email', {
      template: 'welcome',
      to: email,
      subject: 'Welcome to CareKit | أهلا بك في كيركت',
      context: { firstName },
      correlationId: correlationStorage.getStore() ?? null,
    });

    this.logger.log(`Queued welcome email to ${email}`);
  }

  async sendPractitionerWelcome(
    email: string,
    firstName: string,
    otpCode: string,
  ): Promise<void> {
    await this.emailQueue.add('send-email', {
      template: 'practitioner-welcome',
      to: email,
      subject:
        'Welcome to CareKit — Set Your Password | مرحبا بك في كيركت — عيّن كلمة مرورك',
      context: { firstName, otpCode },
      correlationId: correlationStorage.getStore() ?? null,
    });

    this.logger.log(`Queued practitioner-welcome email to ${email}`);
  }

  async sendBookingConfirmation(
    email: string,
    firstName: string,
    bookingDetails: BookingDetails,
  ): Promise<void> {
    await this.emailQueue.add('send-email', {
      template: 'booking-confirmation',
      to: email,
      subject: 'Booking Confirmed | تأكيد الحجز',
      context: {
        firstName,
        date: bookingDetails.date,
        time: bookingDetails.time,
        practitioner: bookingDetails.practitioner,
        service: bookingDetails.service,
      },
      correlationId: correlationStorage.getStore() ?? null,
    });

    this.logger.log(`Queued booking-confirmation email to ${email}`);
  }

  async sendRaw(input: {
    to: string;
    subject: string;
    bodyEn: string;
    bodyAr: string;
  }): Promise<void> {
    await this.emailQueue.add('send-email', {
      template: 'raw',
      to: input.to,
      subject: input.subject,
      context: { bodyEn: input.bodyEn, bodyAr: input.bodyAr },
      correlationId: null,
    });
    this.logger.log(`Queued raw email to ${input.to}`);
  }
}
