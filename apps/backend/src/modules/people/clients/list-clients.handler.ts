import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { ListClientsDto } from './list-clients.dto';
import { serializeClient } from './client.serializer';

export type ListClientsQuery = ListClientsDto & {
  tenantId: string;
  page: number;
  limit: number;
};

@Injectable()
export class ListClientsHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: ListClientsQuery) {
    const where = {
      tenantId: query.tenantId,
      deletedAt: null,
      isActive: query.isActive,
      gender: query.gender,
      source: query.source,
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' as const } },
              { firstName: { contains: query.search, mode: 'insensitive' as const } },
              { lastName: { contains: query.search, mode: 'insensitive' as const } },
              { phone: { contains: query.search, mode: 'insensitive' as const } },
              { email: { contains: query.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.client.findMany({
        where,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.client.count({ where }),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / query.limit));

    return {
      items: items.map(serializeClient),
      meta: {
        total,
        page: query.page,
        perPage: query.limit,
        totalPages,
        hasNextPage: query.page < totalPages,
        hasPreviousPage: query.page > 1,
      },
    };
  }
}
