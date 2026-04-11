import { Inject, Injectable, Logger } from '@nestjs/common';
import type { NotificationType, Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service.js';
import type { Channel, ChannelSendPayload } from './channel.interface.js';
import { MessagingEvent } from './messaging-events.js';
import { TEMPLATES } from './messaging-templates.js';
import { MessagingPreferencesService } from './messaging-preferences.service.js';

@Injectable()
export class MessagingDispatcherService {
  private readonly logger = new Logger(MessagingDispatcherService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly prefs: MessagingPreferencesService,
    @Inject('PUSH_CHANNEL') private readonly pushChannel: Channel,
    @Inject('EMAIL_CHANNEL') private readonly emailChannel: Channel,
    @Inject('SMS_CHANNEL') private readonly smsChannel: Channel,
  ) {}

  async dispatch(input: {
    event: MessagingEvent;
    recipientUserId: string;
    context: Record<string, string>;
    overrideChannels?: ('push' | 'email' | 'sms')[];
    recipientEmail?: string;
  }): Promise<void> {
    const template = TEMPLATES[input.event];
    const rendered = template.render(input.context);

    // 1. Always persist inbox row
    const notification = await this.prisma.notification.create({
      data: {
        userId: input.recipientUserId,
        titleAr: rendered.titleAr,
        titleEn: rendered.titleEn,
        bodyAr: rendered.bodyAr,
        bodyEn: rendered.bodyEn,
        type: rendered.notificationType as NotificationType,
        data: { event: input.event, ...input.context } as Prisma.InputJsonValue,
      },
    });

    // 2. Resolve which channels to attempt
    const candidateChannels = input.overrideChannels ?? template.defaultChannels;
    const bypassPrefs = template.overridePreferences === true;

    const activeChannels = bypassPrefs
      ? candidateChannels
      : await this.filterByPreferences(
          input.recipientUserId,
          candidateChannels,
          template.category,
        );

    if (activeChannels.length === 0) return;

    // 3. Fan out (parallel, swallow errors per channel)
    const payload: ChannelSendPayload = {
      userId: input.recipientUserId,
      titleAr: rendered.titleAr,
      titleEn: rendered.titleEn,
      bodyAr: rendered.bodyAr,
      bodyEn: rendered.bodyEn,
      data: { notificationId: notification.id, event: input.event },
      event: input.event,
      recipientEmail: input.recipientEmail,
    };

    await Promise.allSettled(
      activeChannels.map((ch) => this.sendOnChannel(ch, payload)),
    );
  }

  private async filterByPreferences(
    userId: string,
    channels: ('push' | 'email' | 'sms')[],
    category: string,
  ): Promise<('push' | 'email' | 'sms')[]> {
    const results = await Promise.all(
      channels.map(async (ch) => ({
        ch,
        enabled: await this.prefs.isChannelEnabled(userId, ch, category),
      })),
    );
    return results.filter((r) => r.enabled).map((r) => r.ch);
  }

  private async sendOnChannel(
    channelName: 'push' | 'email' | 'sms',
    payload: ChannelSendPayload,
  ): Promise<void> {
    const channel = this.channelFor(channelName);
    if (!channel.isEnabled()) {
      this.logger.debug(`Channel ${channelName} is disabled at config level — skipped`);
      return;
    }
    try {
      const result = await channel.send(payload);
      if (!result.ok && result.skipped) {
        this.logger.debug(`Channel ${channelName} skipped: ${result.skipped}`);
      } else if (!result.ok && result.error) {
        this.logger.warn(`Channel ${channelName} send failed: ${result.error}`);
      }
    } catch (err) {
      this.logger.error(`Channel ${channelName} threw unexpectedly`, err);
    }
  }

  private channelFor(name: 'push' | 'email' | 'sms'): Channel {
    switch (name) {
      case 'push': return this.pushChannel;
      case 'email': return this.emailChannel;
      case 'sms': return this.smsChannel;
    }
  }
}
