import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../infrastructure/database';

export interface ListImpersonationSessionsQuery {
  page: number;
  perPage: number;
  active?: boolean;
  superAdminUserId?: string;
  organizationId?: string;
}

@Injectable()
export class ListImpersonationSessionsHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(q: ListImpersonationSessionsQuery) {
    const where: Prisma.ImpersonationSessionWhereInput = {};
    if (q.superAdminUserId) where.superAdminUserId = q.superAdminUserId;
    if (q.organizationId) where.organizationId = q.organizationId;
    if (q.active === true) {
      where.endedAt = null;
      where.expiresAt = { gt: new Date() };
    } else if (q.active === false) {
      where.OR = [{ endedAt: { not: null } }, { expiresAt: { lte: new Date() } }];
    }

    const [items, total] = await Promise.all([
      this.prisma.$allTenants.impersonationSession.findMany({
        where,
        orderBy: { startedAt: 'desc' },
        skip: (q.page - 1) * q.perPage,
        take: q.perPage,
      }),
      this.prisma.$allTenants.impersonationSession.count({ where }),
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
