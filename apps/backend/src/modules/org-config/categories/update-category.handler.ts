import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import type { UpdateCategoryDto } from './category.dto';

@Injectable()
export class UpdateCategoryHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(dto: UpdateCategoryDto) {
    const existing = await this.prisma.serviceCategory.findFirst({
      where: { id: dto.categoryId, tenantId: dto.tenantId },
    });
    if (!existing) throw new NotFoundException('ServiceCategory not found');

    return this.prisma.serviceCategory.update({
      where: { id: dto.categoryId },
      data: {
        ...(dto.nameAr !== undefined && { nameAr: dto.nameAr }),
        ...(dto.nameEn !== undefined && { nameEn: dto.nameEn }),
        ...(dto.departmentId !== undefined && { departmentId: dto.departmentId }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
  }
}
