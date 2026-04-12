import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { ListCouponsDto } from './list-coupons.dto';

export type ListCouponsQuery = ListCouponsDto & { tenantId: string };

@Injectable()
export class ListCouponsHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: ListCouponsQuery) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { tenantId: query.tenantId };
    if (query.search) {
      where['code'] = { contains: query.search, mode: 'insensitive' };
    }
    if (query.status === 'active') where['isActive'] = true;
    else if (query.status === 'inactive') where['isActive'] = false;
    else if (query.status === 'expired') {
      where['expiresAt'] = { lt: new Date() };
      where['isActive'] = true;
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.coupon.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
      this.prisma.coupon.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }
}
