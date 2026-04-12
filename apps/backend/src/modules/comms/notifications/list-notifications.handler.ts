import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { ListNotificationsDto } from './list-notifications.dto';

export type ListNotificationsCommand = Omit<ListNotificationsDto, 'page' | 'limit'> & {
  tenantId: string;
  page: number;
  limit: number;
};

@Injectable()
export class ListNotificationsHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(cmd: ListNotificationsCommand) {
    const where = {
      tenantId: cmd.tenantId,
      recipientId: cmd.recipientId,
      ...(cmd.unreadOnly ? { isRead: false } : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (cmd.page - 1) * cmd.limit,
        take: cmd.limit,
      }),
      this.prisma.notification.count({ where }),
    ]);

    return {
      data,
      meta: { total, page: cmd.page, limit: cmd.limit, totalPages: Math.ceil(total / cmd.limit) },
    };
  }
}
