import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { ListBranchesDto } from './list-branches.dto';

export type ListBranchesQuery = ListBranchesDto & { tenantId: string };

@Injectable()
export class ListBranchesHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(dto: ListBranchesQuery) {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const skip = (page - 1) * limit;

    const where = {
      tenantId: dto.tenantId,
      ...(dto.isActive !== undefined && { isActive: dto.isActive }),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.branch.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.branch.count({ where }),
    ]);

    return { items, total, page, limit };
  }
}
