import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { NotificationType, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service.js';
import { CreateNotificationDto } from './dto/create-notification.dto.js';
import { RegisterFcmTokenDto } from './dto/register-fcm-token.dto.js';
import { PushService } from './push.service.js';
import { SmsService } from './sms.service.js';
import { WhitelabelService } from '../whitelabel/whitelabel.service.js';
import { parsePaginationParams, buildPaginationMeta } from '../../common/helpers/pagination.helper.js';

/** Notification types that warrant an SMS to the user */
const SMS_ELIGIBLE_TYPES: ReadonlySet<string> = new Set([
  'booking_reminder',
  'booking_reminder_urgent',
  'booking_confirmed',
  'booking_cancelled',
  'cancellation_rejected',
]);

/** Maps notification types to WhiteLabelConfig keys */
const TYPE_TO_CONFIG_KEY: Record<string, string> = {
  booking_confirmed: 'notify_new_bookings',
  booking_completed: 'notify_new_bookings',
  booking_rescheduled: 'notify_new_bookings',
  booking_expired: 'notify_new_bookings',
  booking_cancelled: 'notify_cancellations',
  cancellation_requested: 'notify_cancellations',
  cancellation_rejected: 'notify_cancellations',
  problem_report: 'notify_problems',
  payment_received: 'notify_payments',
  new_rating: 'notify_ratings',
  booking_reminder: 'notify_reminders',
  booking_reminder_urgent: 'notify_reminders',
  waitlist_slot_available: 'notify_waitlist',
};

interface NotificationListQuery {
  page?: number;
  perPage?: number;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pushService: PushService,
    private readonly smsService: SmsService,
    private readonly whitelabelService: WhitelabelService,
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
    // Always persist the notification for history/audit
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

    // Check clinic-wide notification settings before sending push/SMS
    const enabled = await this.isNotificationEnabled(dto.type);
    if (!enabled) return notification;

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

    // Fire-and-forget SMS for critical notification types
    if (SMS_ELIGIBLE_TYPES.has(dto.type)) {
      this.sendSmsToUser(dto.userId, dto.bodyAr || dto.bodyEn);
    }

    return notification;
  }

  // ═══════════════════════════════════════════════════════════════
  //  CLINIC-WIDE NOTIFICATION CHECK
  // ═══════════════════════════════════════════════════════════════

  private async isNotificationEnabled(type: string): Promise<boolean> {
    const configKey = TYPE_TO_CONFIG_KEY[type];
    // Types without a config key (reminder, system_alert, waitlist) are always enabled
    if (!configKey) return true;

    try {
      const configMap = await this.whitelabelService.getConfigMap();
      const value = configMap[configKey];
      // Default to enabled if config key doesn't exist
      return value === undefined || value === 'true';
    } catch {
      // On error, default to enabled to avoid silently dropping notifications
      return true;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  //  SMS — fire-and-forget helper
  // ═══════════════════════════════════════════════════════════════

  private sendSmsToUser(userId: string, message: string): void {
    this.prisma.user
      .findUnique({ where: { id: userId }, select: { phone: true } })
      .then((user) => {
        if (!user?.phone) return;
        return this.smsService.sendSms(user.phone, message);
      })
      .catch((err) => {
        this.logger.error(`SMS send failed for user ${userId}`, err);
      });
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
