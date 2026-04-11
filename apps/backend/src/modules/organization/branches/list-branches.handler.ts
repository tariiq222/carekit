import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import type { ListBranchesDto } from './branch.dto';

@Injectable()
export class ListBranchesHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(dto: ListBranchesDto) {
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
