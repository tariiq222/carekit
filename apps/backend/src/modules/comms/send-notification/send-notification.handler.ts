import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';
import { SendPushHandler } from '../send-push/send-push.handler';
import { SendEmailHandler } from '../send-email/send-email.handler';
import { SendSmsHandler } from '../send-sms/send-sms.handler';
import { SendNotificationDto } from './send-notification.dto';

export type SendNotificationCommand = SendNotificationDto;

@Injectable()
export class SendNotificationHandler {
  private readonly logger = new Logger(SendNotificationHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly push: SendPushHandler,
    private readonly email: SendEmailHandler,
    private readonly sms: SendSmsHandler,
  ) {}

  async execute(dto: SendNotificationCommand): Promise<void> {
    try {
      await this.prisma.notification.create({
        data: {
          recipientId: dto.recipientId,
          recipientType: dto.recipientType,
          type: dto.type,
          title: dto.title,
          body: dto.body,
          metadata: (dto.metadata as Prisma.InputJsonValue) ?? undefined,
        },
      });
    } catch (err) {
      this.logger.error('Failed to persist in-app notification', err);
      // Don't return — still attempt channel dispatches
    }

    // 'in-app' channel is handled by the notification.create above.
    // Remaining channels dispatch via external adapters.
    const tasks: Promise<void>[] = [];

    if (dto.channels.includes('push') && dto.fcmToken) {
      tasks.push(this.push.execute({ token: dto.fcmToken, title: dto.title, body: dto.body }));
    }

    if (dto.channels.includes('email') && dto.recipientEmail && dto.emailTemplateSlug) {
      tasks.push(this.email.execute({
        to: dto.recipientEmail,
        templateSlug: dto.emailTemplateSlug,
        vars: dto.emailVars ?? {},
      }));
    }

    if (dto.channels.includes('sms') && dto.recipientPhone) {
      tasks.push(this.sms.execute({ phone: dto.recipientPhone, body: dto.body }));
    }

    await Promise.allSettled(tasks);
  }
}
