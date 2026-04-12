import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import type { CreateCategoryDto } from './category.dto';

@Injectable()
export class CreateCategoryHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(dto: CreateCategoryDto) {
    return this.prisma.serviceCategory.create({
      data: {
        tenantId: dto.tenantId,
        nameAr: dto.nameAr,
        nameEn: dto.nameEn,
        departmentId: dto.departmentId ?? null,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }
}
