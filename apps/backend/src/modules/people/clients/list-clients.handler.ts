import { Injectable } from '@nestjs/common';
import { ClientGender, ClientSource } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';

export interface ListClientsQuery {
  tenantId: string;
  page: number;
  limit: number;
  search?: string;
  isActive?: boolean;
  gender?: ClientGender;
  source?: ClientSource;
}

@Injectable()
export class ListClientsHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: ListClientsQuery) {
    const where = {
      tenantId: query.tenantId,
      isActive: query.isActive,
      gender: query.gender,
      source: query.source,
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' as const } },
              { phone: { contains: query.search, mode: 'insensitive' as const } },
              { email: { contains: query.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.client.findMany({
        where,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.client.count({ where }),
    ]);

    return {
      data,
      meta: { total, page: query.page, limit: query.limit, totalPages: Math.ceil(total / query.limit) },
    };
  }
}
