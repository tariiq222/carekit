import { Injectable, Logger } from '@nestjs/common';
import type { Channel, ChannelSendPayload, ChannelSendResult } from '../../core/channel.interface.js';
import { SmsService } from './sms.service.js';
import { PrismaService } from '../../../../database/prisma.service.js';

@Injectable()
export class SmsChannel implements Channel {
  readonly name = 'sms' as const;
  private readonly logger = new Logger(SmsChannel.name);

  constructor(
    private readonly smsService: SmsService,
    private readonly prisma: PrismaService,
  ) {}

  isEnabled(): boolean {
    return this.smsService.isEnabled();
  }

  async send(payload: ChannelSendPayload): Promise<ChannelSendResult> {
    if (!this.isEnabled()) return { ok: false, skipped: 'channel_disabled' };

    const user = await this.prisma.user.findUnique({
      where: { id: payload.userId },
      select: { phone: true },
    });

    if (!user?.phone) return { ok: false, skipped: 'no_address' };

    try {
      await this.smsService.sendSms(user.phone, payload.bodyAr || payload.bodyEn);
      return { ok: true };
    } catch (err) {
      this.logger.error(`SMS send failed for user ${payload.userId}`, err);
      return { ok: false, error: String(err) };
    }
  }
}
