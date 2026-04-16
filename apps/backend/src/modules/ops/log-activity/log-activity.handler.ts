import { Injectable } from '@nestjs/common';
import { ActivityAction, Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';

export interface LogActivityCommand {
  userId?: string;
  userEmail?: string;
  action: ActivityAction;
  entity: string;
  entityId?: string;
  description: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class LogActivityHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(cmd: LogActivityCommand): Promise<void> {
    await this.prisma.activityLog.create({
      data: {
        userId: cmd.userId,
        userEmail: cmd.userEmail,
        action: cmd.action,
        entity: cmd.entity,
        entityId: cmd.entityId,
        description: cmd.description,
        metadata: cmd.metadata ? (cmd.metadata as Prisma.InputJsonValue) : undefined,
        ipAddress: cmd.ipAddress,
        userAgent: cmd.userAgent,
      },
    });
  }
}
