import { Injectable } from '@nestjs/common';
import type { Channel, ChannelSendPayload, ChannelSendResult } from '../../core/channel.interface.js';
import { EmailService } from './email.service.js';
import { PrismaService } from '../../../../database/prisma.service.js';

@Injectable()
export class EmailChannel implements Channel {
  readonly name = 'email' as const;

  constructor(
    private readonly emailService: EmailService,
    private readonly prisma: PrismaService,
  ) {}

  isEnabled(): boolean {
    return true; // MailerModule handles unavailability internally
  }

  async send(payload: ChannelSendPayload): Promise<ChannelSendResult> {
    const email = payload.recipientEmail ?? await this.resolveEmail(payload.userId);
    if (!email) return { ok: false, skipped: 'no_address' };

    try {
      await this.emailService.sendRaw({
        to: email,
        subject: `${payload.titleEn} | ${payload.titleAr}`,
        bodyEn: payload.bodyEn,
        bodyAr: payload.bodyAr,
      });
      return { ok: true };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  }

  private async resolveEmail(userId: string): Promise<string | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    return user?.email ?? null;
  }
}
