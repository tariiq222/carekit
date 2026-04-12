import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { ListActivityDto } from './list-activity.dto';

export type ListActivityCommand = ListActivityDto & { tenantId: string };

@Injectable()
export class ListActivityHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(cmd: ListActivityCommand) {
    const page = Math.max(1, cmd.page ?? 1);
    const limit = Math.min(100, cmd.limit ?? 50);
    const skip = (page - 1) * limit;

    const from = cmd.from ? new Date(cmd.from) : undefined;
    const to = cmd.to ? new Date(cmd.to) : undefined;

    const where = {
      tenantId: cmd.tenantId,
      ...(cmd.userId ? { userId: cmd.userId } : {}),
      ...(cmd.entity ? { entity: cmd.entity } : {}),
      ...(cmd.entityId ? { entityId: cmd.entityId } : {}),
      ...(cmd.action ? { action: cmd.action } : {}),
      ...(from || to
        ? {
            occurredAt: {
              ...(from ? { gte: from } : {}),
              ...(to ? { lte: to } : {}),
            },
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.activityLog.findMany({
        where,
        orderBy: { occurredAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.activityLog.count({ where }),
    ]);

    return {
      items,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }
}
