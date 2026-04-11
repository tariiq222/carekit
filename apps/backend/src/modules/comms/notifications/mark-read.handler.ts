import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';

export interface MarkReadDto {
  tenantId: string;
  recipientId: string;
  notificationId?: string;
}

@Injectable()
export class MarkReadHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(dto: MarkReadDto): Promise<void> {
    await this.prisma.notification.updateMany({
      where: {
        tenantId: dto.tenantId,
        recipientId: dto.recipientId,
        isRead: false,
        ...(dto.notificationId ? { id: dto.notificationId } : {}),
      },
      data: { isRead: true, readAt: new Date() },
    });
  }
}
