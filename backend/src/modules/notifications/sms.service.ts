import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { resilientFetch } from '../../common/helpers/resilient-fetch.helper.js';

type SmsProvider = 'unifonic' | 'twilio';

const CIRCUIT_NAME = 'sms';
const TIMEOUT_MS = 10_000;

@Injectable()
export class SmsService implements OnModuleInit {
  private readonly logger = new Logger(SmsService.name);

  private provider: SmsProvider | null = null;
  private apiKey = '';
  private senderId = '';
  private enabled = false;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const rawProvider = this.config.get<string>('SMS_PROVIDER');
    this.apiKey = this.config.get<string>('SMS_API_KEY') ?? '';
    this.senderId = this.config.get<string>('SMS_SENDER_ID') ?? '';

    if (!rawProvider) {
      this.logger.warn(
        'SMS_PROVIDER not configured — SMS notifications disabled',
      );
      return;
    }

    const normalized = rawProvider.toLowerCase() as SmsProvider;
    if (normalized !== 'unifonic' && normalized !== 'twilio') {
      this.logger.warn(
        `Unknown SMS_PROVIDER "${rawProvider}" — SMS notifications disabled. Supported: unifonic, twilio`,
      );
      return;
    }

    if (!this.apiKey) {
      this.logger.warn(
        'SMS_API_KEY not configured — SMS notifications disabled',
      );
      return;
    }

    this.provider = normalized;
    this.enabled = true;
    this.logger.log(`SMS channel initialized with provider: ${this.provider}`);
  }

  /** Send an SMS. Throws on failure — caller should handle errors. */
  async sendSms(phone: string, message: string): Promise<void> {
    if (!this.enabled || !this.provider) return;

    if (!phone || !message) {
      this.logger.warn('sendSms called with empty phone or message — skipped');
      return;
    }

    switch (this.provider) {
      case 'unifonic':
        await this.sendViaUnionic(phone, message);
        break;
      case 'twilio':
        await this.sendViaTwilio(phone, message);
        break;
    }
  }

  // ─── Unifonic ─────────────────────────────────────────────────

  private async sendViaUnionic(phone: string, message: string): Promise<void> {
    const url = 'https://el.cloud.unifonic.com/rest/SMS/messages';

    const body = new URLSearchParams({
      AppSid: this.apiKey,
      Body: message,
      Recipient: phone,
      SenderID: this.senderId,
    });

    const response = await resilientFetch(
      url,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      },
      { circuit: CIRCUIT_NAME, timeoutMs: TIMEOUT_MS },
    );

    if (!response.ok) {
      const text = await response.text().catch(() => 'no body');
      this.logger.error(
        `Unifonic SMS failed — status ${response.status}: ${text}`,
      );
      throw new Error(`Unifonic SMS failed with status ${response.status}`);
    }

    this.logger.debug(`SMS sent via Unifonic to ${phone}`);
  }

  // ─── Twilio ───────────────────────────────────────────────────

  private async sendViaTwilio(phone: string, message: string): Promise<void> {
    // Twilio uses SMS_API_KEY as "AccountSID:AuthToken"
    const [accountSid, authToken] = this.apiKey.split(':');

    if (!accountSid || !authToken) {
      this.logger.error(
        'Twilio SMS_API_KEY must be in format "AccountSID:AuthToken"',
      );
      return;
    }

    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;

    const body = new URLSearchParams({
      To: phone,
      From: this.senderId,
      Body: message,
    });

    const credentials = Buffer.from(`${accountSid}:${authToken}`).toString(
      'base64',
    );

    const response = await resilientFetch(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${credentials}`,
        },
        body: body.toString(),
      },
      { circuit: CIRCUIT_NAME, timeoutMs: TIMEOUT_MS },
    );

    if (!response.ok) {
      const text = await response.text().catch(() => 'no body');
      this.logger.error(
        `Twilio SMS failed — status ${response.status}: ${text}`,
      );
      throw new Error(`Twilio SMS failed with status ${response.status}`);
    }

    this.logger.debug(`SMS sent via Twilio to ${phone}`);
  }
}
