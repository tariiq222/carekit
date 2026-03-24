import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';

export interface LogActivityParams {
  userId?: string;
  action: string;
  module: string;
  resourceId?: string;
  description?: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class ActivityLogService {
  private readonly logger = new Logger(ActivityLogService.name);

  constructor(private readonly prisma: PrismaService) {}

  async log(params: LogActivityParams): Promise<void> {
    try {
      await this.prisma.activityLog.create({
        data: {
          userId: params.userId,
          action: params.action,
          module: params.module,
          resourceId: params.resourceId,
          description: params.description,
          oldValues: params.oldValues
            ? JSON.parse(JSON.stringify(params.oldValues))
            : undefined,
          newValues: params.newValues
            ? JSON.parse(JSON.stringify(params.newValues))
            : undefined,
          ipAddress: params.ipAddress,
          userAgent: params.userAgent,
        },
      });
    } catch (err) {
      // Never fail the main operation because of audit logging
      this.logger.error('Failed to write activity log', err);
    }
  }
}
