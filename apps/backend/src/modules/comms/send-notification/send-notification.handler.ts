import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { SendPushHandler } from '../send-push/send-push.handler';
import { SendEmailHandler } from '../send-email/send-email.handler';
import { SendSmsHandler } from '../send-sms/send-sms.handler';
import type { SendNotificationDto } from './send-notification.dto';

@Injectable()
export class SendNotificationHandler {
  private readonly logger = new Logger(SendNotificationHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly push: SendPushHandler,
    private readonly email: SendEmailHandler,
    private readonly sms: SendSmsHandler,
  ) {}

  async execute(dto: SendNotificationDto): Promise<void> {
    await this.prisma.notification.create({
      data: {
        tenantId: dto.tenantId,
        recipientId: dto.recipientId,
        recipientType: dto.recipientType,
        type: dto.type,
        title: dto.title,
        body: dto.body,
        metadata: dto.metadata as never ?? undefined,
      },
    });

    const tasks: Promise<void>[] = [];

    if (dto.channels.includes('push') && dto.fcmToken) {
      tasks.push(this.push.execute({ token: dto.fcmToken, title: dto.title, body: dto.body }));
    }

    if (dto.channels.includes('email') && dto.recipientEmail && dto.emailTemplateSlug) {
      tasks.push(this.email.execute({
        tenantId: dto.tenantId,
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
