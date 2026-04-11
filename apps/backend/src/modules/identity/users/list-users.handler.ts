import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';

export interface ListUsersQuery {
  tenantId: string;
  page: number;
  limit: number;
  search?: string;
  isActive?: boolean;
}

@Injectable()
export class ListUsersHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: ListUsersQuery) {
    const where = {
      tenantId: query.tenantId,
      isActive: query.isActive,
      ...(query.search
        ? { OR: [{ name: { contains: query.search, mode: 'insensitive' as const } }, { email: { contains: query.search, mode: 'insensitive' as const } }] }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({ where, skip: (query.page - 1) * query.limit, take: query.limit, orderBy: { createdAt: 'desc' }, omit: { passwordHash: true } }),
      this.prisma.user.count({ where }),
    ]);

    return { data, meta: { total, page: query.page, limit: query.limit, totalPages: Math.ceil(total / query.limit) } };
  }
}
