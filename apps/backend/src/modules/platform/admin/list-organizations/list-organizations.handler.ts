import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database';

export interface ListOrganizationsQuery {
  page: number;
  perPage: number;
  search?: string;
  suspended?: boolean;
}

@Injectable()
export class ListOrganizationsHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(q: ListOrganizationsQuery) {
    const where: Record<string, unknown> = {};

    if (q.search) {
      where.OR = [
        { slug: { contains: q.search, mode: 'insensitive' } },
        { nameAr: { contains: q.search, mode: 'insensitive' } },
        { nameEn: { contains: q.search, mode: 'insensitive' } },
      ];
    }
    if (q.suspended === true) where.suspendedAt = { not: null };
    if (q.suspended === false) where.suspendedAt = null;

    const [items, total] = await Promise.all([
      this.prisma.$allTenants.organization.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.perPage,
        take: q.perPage,
        select: {
          id: true,
          slug: true,
          nameAr: true,
          nameEn: true,
          status: true,
          verticalId: true,
          trialEndsAt: true,
          suspendedAt: true,
          suspendedReason: true,
          createdAt: true,
        },
      }),
      this.prisma.$allTenants.organization.count({ where }),
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
