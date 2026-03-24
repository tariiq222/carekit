import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { NotificationType, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service.js';
import { CreateNotificationDto } from './dto/create-notification.dto.js';
import { RegisterFcmTokenDto } from './dto/register-fcm-token.dto.js';
import { PushService } from './push.service.js';
import { parsePaginationParams, buildPaginationMeta } from '../../common/helpers/pagination.helper.js';

interface NotificationListQuery {
  page?: number;
  perPage?: number;
}

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pushService: PushService,
  ) {}

  // ═══════════════════════════════════════════════════════════════
  //  FIND ALL — paginated, user-scoped
  // ═══════════════════════════════════════════════════════════════

  async findAll(userId: string, query: NotificationListQuery) {
    const { page, perPage, skip } = parsePaginationParams(query.page, query.perPage);

    const where = { userId };

    const [rawItems, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: perPage,
      }),
      this.prisma.notification.count({ where }),
    ]);

    // Strip userId and user from public response
    const items = rawItems.map(({ userId: _, ...item }) => item);

    return {
      items,
      meta: buildPaginationMeta(total, page, perPage),
    };
  }

  // ═══════════════════════════════════════════════════════════════
  //  GET UNREAD COUNT
  // ═══════════════════════════════════════════════════════════════

  async getUnreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({
      where: {
        userId,
        isRead: false,
      },
    });
  }

  // ═══════════════════════════════════════════════════════════════
  //  MARK AS READ — single notification (ownership check)
  // ═══════════════════════════════════════════════════════════════

  async markAsRead(notificationId: string, userId: string) {
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Notification not found',
        error: 'NOT_FOUND',
      });
    }

    if (notification.userId !== userId) {
      throw new ForbiddenException({
        statusCode: 403,
        message: 'You can only mark your own notifications as read',
        error: 'FORBIDDEN',
      });
    }

    return this.prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true, readAt: new Date() },
    });
  }

  // ═══════════════════════════════════════════════════════════════
  //  MARK ALL AS READ
  // ═══════════════════════════════════════════════════════════════

  async markAllAsRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: {
        userId,
        isRead: false,
      },
      data: { isRead: true, readAt: new Date() },
    });
  }

  // ═══════════════════════════════════════════════════════════════
  //  CREATE NOTIFICATION (internal use)
  // ═══════════════════════════════════════════════════════════════

  async createNotification(dto: CreateNotificationDto) {
    const notification = await this.prisma.notification.create({
      data: {
        userId: dto.userId,
        titleAr: dto.titleAr,
        titleEn: dto.titleEn,
        bodyAr: dto.bodyAr,
        bodyEn: dto.bodyEn,
        type: dto.type as NotificationType,
        data: dto.data as Prisma.InputJsonValue | undefined,
      },
    });

    // Fire-and-forget push notification
    this.pushService
      .sendToUser(dto.userId, {
        titleAr: dto.titleAr,
        titleEn: dto.titleEn,
        bodyAr: dto.bodyAr,
        bodyEn: dto.bodyEn,
        data: {
          type: dto.type,
          ...(dto.data ? { payload: JSON.stringify(dto.data) } : {}),
        },
      })
      .catch(() => {}); // Never fail the main operation

    return notification;
  }

  // ═══════════════════════════════════════════════════════════════
  //  REGISTER FCM TOKEN (upsert)
  // ═══════════════════════════════════════════════════════════════

  async registerFcmToken(userId: string, dto: RegisterFcmTokenDto) {
    return this.prisma.fcmToken.upsert({
      where: {
        userId_token: {
          userId,
          token: dto.token,
        },
      },
      create: {
        userId,
        token: dto.token,
        platform: dto.platform,
      },
      update: {
        platform: dto.platform,
      },
    });
  }

  // ═══════════════════════════════════════════════════════════════
  //  UNREGISTER FCM TOKEN
  // ═══════════════════════════════════════════════════════════════

  async unregisterFcmToken(userId: string, token: string) {
    await this.prisma.fcmToken.deleteMany({
      where: {
        userId,
        token,
      },
    });
  }
}
