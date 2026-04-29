import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

const DEFAULT_FROM = 'CareKit <noreply@webvue.pro>';
const DEFAULT_REPLY_TO = 'support@webvue.pro';

@Injectable()
export class PlatformMailerService implements OnModuleInit {
  private readonly logger = new Logger(PlatformMailerService.name);
  private client: Resend | null = null;
  private from = DEFAULT_FROM;
  private replyTo = DEFAULT_REPLY_TO;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const apiKey = this.config.get<string>('RESEND_API_KEY');
    this.from = this.config.get<string>('RESEND_FROM') ?? DEFAULT_FROM;
    this.replyTo = this.config.get<string>('RESEND_REPLY_TO') ?? DEFAULT_REPLY_TO;

    if (!apiKey) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('RESEND_API_KEY is required in production');
      }
      this.logger.warn(
        'RESEND_API_KEY not set — platform mail disabled (dev/test mode).',
      );
      return;
    }

    this.client = new Resend(apiKey);
    this.logger.log('PlatformMailerService initialized');
  }

  isAvailable(): boolean {
    return this.client !== null;
  }
}
