import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { ListDepartmentsDto } from './list-departments.dto';

export type ListDepartmentsQuery = ListDepartmentsDto & { tenantId: string };

@Injectable()
export class ListDepartmentsHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(dto: ListDepartmentsQuery) {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const skip = (page - 1) * limit;

    const where = {
      tenantId: dto.tenantId,
      ...(dto.isActive !== undefined && { isActive: dto.isActive }),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.department.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
        include: { categories: { where: { isActive: true }, orderBy: { sortOrder: 'asc' } } },
      }),
      this.prisma.department.count({ where }),
    ]);

    return { items, total, page, limit };
  }
}
