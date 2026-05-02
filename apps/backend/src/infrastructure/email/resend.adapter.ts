// resend-adapter — tenant-level email via Resend API.

import { Logger } from '@nestjs/common';
import type { EmailProvider, EmailSendPayload, EmailSendResult } from './email-provider.interface';

export type ResendCredentials = {
  apiKey: string;
};

export class ResendEmailAdapter implements EmailProvider {
  readonly name = 'RESEND' as const;
  private readonly logger = new Logger(ResendEmailAdapter.name);

  constructor(private readonly creds: ResendCredentials) {}

  isAvailable(): boolean {
    return true;
  }

  async sendMail(payload: EmailSendPayload): Promise<EmailSendResult> {
    const from =
      payload.fromName && payload.fromEmail
        ? `${payload.fromName} <${payload.fromEmail}>`
        : payload.fromEmail ?? 'noreply@deqah.sa';

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.creds.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [payload.to],
        subject: payload.subject,
        html: payload.html,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Resend API error ${res.status}: ${body}`);
    }

    const data = (await res.json()) as { id: string };
    this.logger.debug(`Resend sent to ${payload.to}: ${data.id}`);
    return { messageId: data.id };
  }
}
