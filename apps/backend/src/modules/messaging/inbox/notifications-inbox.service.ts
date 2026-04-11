import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { DevicePlatform } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service.js';
import {
  parsePaginationParams,
  buildPaginationMeta,
} from '../../../common/helpers/pagination.helper.js';

@Injectable()
export class NotificationsInboxService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: string, query: { page?: number; perPage?: number }) {
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
    const items = rawItems.map(({ userId: _, ...item }) => item);
    return { items, meta: buildPaginationMeta(total, page, perPage) };
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({ where: { userId, isRead: false } });
  }

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

  async markAllAsRead(userId: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async registerFcmToken(userId: string, token: string, platform: DevicePlatform): Promise<void> {
    await this.prisma.fcmToken.upsert({
      where: { userId_token: { userId, token } },
      create: { userId, token, platform },
      update: { platform },
    });
  }

  async unregisterFcmToken(userId: string, token: string): Promise<void> {
    await this.prisma.fcmToken.deleteMany({ where: { userId, token } });
  }
}
