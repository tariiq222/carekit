import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

interface BookingDetails {
  date: string;
  time: string;
  practitioner: string;
  service: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(
    @InjectQueue('email') private readonly emailQueue: Queue,
  ) {}

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
    });

    this.logger.log(`Queued ${template} email to ${email}`);
  }

  async sendWelcome(email: string, firstName: string): Promise<void> {
    await this.emailQueue.add('send-email', {
      template: 'welcome',
      to: email,
      subject: 'Welcome to CareKit | أهلا بك في كيركت',
      context: { firstName },
    });

    this.logger.log(`Queued welcome email to ${email}`);
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
    });

    this.logger.log(`Queued booking-confirmation email to ${email}`);
  }
}
