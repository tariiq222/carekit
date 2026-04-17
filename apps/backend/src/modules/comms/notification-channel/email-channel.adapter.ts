import { Injectable, Logger } from '@nestjs/common';
import { SmtpService } from '../../../infrastructure/mail';
import { NotificationChannel } from './notification-channel';

@Injectable()
export class EmailChannelAdapter implements NotificationChannel {
  private readonly logger = new Logger(EmailChannelAdapter.name);

  readonly kind = 'EMAIL' as const;

  constructor(private readonly smtp: SmtpService) {}

  async send(identifier: string, message: string): Promise<void> {
    if (!this.smtp.isAvailable()) {
      this.logger.warn(`SMTP not available — skipping email to ${identifier}`);
      return;
    }

    try {
      await this.smtp.sendMail(
        identifier,
        'رمز التحقق / Verification Code',
        `<div dir="rtl" style="font-family: 'IBM Plex Sans Arabic', Arial, sans-serif; text-align: center; padding: 40px 20px;">
          <h2 style="color: #354FD8; margin-bottom: 24px;">رمز التحقق من CareKit</h2>
          <p style="font-size: 18px; color: #333;">استخدم الرمز التالي:</p>
          <div style="background: #F5F7FA; border-radius: 12px; padding: 24px; margin: 24px 0;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #354FD8;">${message}</span>
          </div>
          <p style="font-size: 14px; color: #888;">سينتهي هذا الرمز خلال 10 دقائق</p>
        </div>
        <div dir="ltr" style="font-family: Arial, sans-serif; text-align: center; padding: 20px; border-top: 1px solid #eee; margin-top: 20px;">
          <h2 style="color: #354FD8; margin-bottom: 24px;">Your CareKit Verification Code</h2>
          <p style="font-size: 18px; color: #333;">Use the following code:</p>
          <div style="background: #F5F7FA; border-radius: 12px; padding: 24px; margin: 24px 0;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #354FD8;">${message}</span>
          </div>
          <p style="font-size: 14px; color: #888;">This code expires in 10 minutes</p>
        </div>`,
      );
    } catch (err) {
      this.logger.error(`Failed to send email to ${identifier}`, err);
      throw err;
    }
  }
}
