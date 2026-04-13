import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';

export interface GetUnreadCountQuery {
  tenantId: string;
  recipientId: string;
}

@Injectable()
export class GetUnreadCountHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: GetUnreadCountQuery): Promise<{ count: number }> {
    const count = await this.prisma.notification.count({
      where: {
        tenantId: query.tenantId,
        recipientId: query.recipientId,
        isRead: false,
      },
    });
    return { count };
  }
}
