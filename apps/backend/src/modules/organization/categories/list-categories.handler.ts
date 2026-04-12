import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import type { ListCategoriesDto } from './category.dto';

@Injectable()
export class ListCategoriesHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(dto: ListCategoriesDto) {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const skip = (page - 1) * limit;

    const where = {
      tenantId: dto.tenantId,
      ...(dto.departmentId !== undefined && { departmentId: dto.departmentId }),
      ...(dto.isActive !== undefined && { isActive: dto.isActive }),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.serviceCategory.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      }),
      this.prisma.serviceCategory.count({ where }),
    ]);

    return { items, total, page, limit };
  }
}
