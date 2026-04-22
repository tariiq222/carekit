import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database';

export interface SearchUsersQuery {
  page: number;
  perPage: number;
  search?: string;
  organizationId?: string;
}

@Injectable()
export class SearchUsersHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(q: SearchUsersQuery) {
    const where: Record<string, unknown> = {};

    if (q.organizationId) {
      where.memberships = { some: { organizationId: q.organizationId } };
    }
    if (q.search) {
      where.OR = [
        { email: { contains: q.search, mode: 'insensitive' } },
        { name: { contains: q.search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.$allTenants.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.perPage,
        take: q.perPage,
        select: {
          id: true,
          email: true,
          name: true,
          phone: true,
          role: true,
          isActive: true,
          isSuperAdmin: true,
          createdAt: true,
        },
      }),
      this.prisma.$allTenants.user.count({ where }),
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
