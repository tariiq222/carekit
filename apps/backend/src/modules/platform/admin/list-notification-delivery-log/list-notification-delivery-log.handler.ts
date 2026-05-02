// Super-admin: list NotificationDeliveryLog across all tenants.
// Uses $allTenants to bypass RLS — same pattern as list-audit-log.handler.ts.

import { Injectable } from '@nestjs/common';
import { DeliveryChannel, DeliveryStatus } from '@prisma/client';
import { PrismaService } from '../../../../infrastructure/database';

export interface ListDeliveryLogQuery {
  organizationId?: string;
  status?: DeliveryStatus;
  channel?: DeliveryChannel;
  page: number;
  perPage: number;
}

@Injectable()
export class ListNotificationDeliveryLogHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(q: ListDeliveryLogQuery) {
    const where = {
      ...(q.organizationId ? { organizationId: q.organizationId } : {}),
      ...(q.status ? { status: q.status } : {}),
      ...(q.channel ? { channel: q.channel } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.$allTenants.notificationDeliveryLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.perPage,
        take: q.perPage,
        select: {
          id: true,
          organizationId: true,
          recipientId: true,
          type: true,
          priority: true,
          channel: true,
          status: true,
          toAddress: true,
          providerName: true,
          attempts: true,
          lastAttemptAt: true,
          sentAt: true,
          errorMessage: true,
          jobId: true,
          createdAt: true,
        },
      }),
      this.prisma.$allTenants.notificationDeliveryLog.count({ where }),
    ]);

    return {
      items,
      meta: {
        page: q.page,
        perPage: q.perPage,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / q.perPage),
      },
    };
  }
}
