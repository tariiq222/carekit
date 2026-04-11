import { Injectable } from '@nestjs/common';
import { ActivityAction } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';

export interface ListActivityQuery {
  tenantId: string;
  userId?: string;
  entity?: string;
  entityId?: string;
  action?: ActivityAction;
  from?: Date;
  to?: Date;
  page?: number;
  limit?: number;
}

@Injectable()
export class ListActivityHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: ListActivityQuery) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, query.limit ?? 50);
    const skip = (page - 1) * limit;

    const where = {
      tenantId: query.tenantId,
      ...(query.userId ? { userId: query.userId } : {}),
      ...(query.entity ? { entity: query.entity } : {}),
      ...(query.entityId ? { entityId: query.entityId } : {}),
      ...(query.action ? { action: query.action } : {}),
      ...(query.from || query.to
        ? {
            occurredAt: {
              ...(query.from ? { gte: query.from } : {}),
              ...(query.to ? { lte: query.to } : {}),
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
