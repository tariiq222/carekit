import { Injectable } from '@nestjs/common';
import type { Channel, ChannelSendPayload, ChannelSendResult } from '../../core/channel.interface.js';
import { PushService } from './push.service.js';

@Injectable()
export class PushChannel implements Channel {
  readonly name = 'push' as const;

  constructor(private readonly pushService: PushService) {}

  isEnabled(): boolean {
    return this.pushService.isEnabled();
  }

  async send(payload: ChannelSendPayload): Promise<ChannelSendResult> {
    if (!this.isEnabled()) return { ok: false, skipped: 'channel_disabled' };
    try {
      await this.pushService.sendToUser(payload.userId, {
        titleAr: payload.titleAr,
        titleEn: payload.titleEn,
        bodyAr: payload.bodyAr,
        bodyEn: payload.bodyEn,
        data: payload.data,
      });
      return { ok: true };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  }
}
