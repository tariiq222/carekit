import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import type { CreateDepartmentDto } from './department.dto';

@Injectable()
export class CreateDepartmentHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(dto: CreateDepartmentDto) {
    return this.prisma.department.create({
      data: {
        tenantId: dto.tenantId,
        nameAr: dto.nameAr,
        nameEn: dto.nameEn,
        isVisible: dto.isVisible ?? true,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }
}
