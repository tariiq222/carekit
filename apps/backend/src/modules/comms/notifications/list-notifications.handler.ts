import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';

export interface ListNotificationsDto {
  tenantId: string;
  recipientId: string;
  unreadOnly?: boolean;
  page: number;
  limit: number;
}

@Injectable()
export class ListNotificationsHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(dto: ListNotificationsDto) {
    const where = {
      tenantId: dto.tenantId,
      recipientId: dto.recipientId,
      ...(dto.unreadOnly ? { isRead: false } : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (dto.page - 1) * dto.limit,
        take: dto.limit,
      }),
      this.prisma.notification.count({ where }),
    ]);

    return {
      data,
      meta: { total, page: dto.page, limit: dto.limit, totalPages: Math.ceil(total / dto.limit) },
    };
  }
}
