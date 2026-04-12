import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import type { UpdateDepartmentDto } from './department.dto';

@Injectable()
export class UpdateDepartmentHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(dto: UpdateDepartmentDto) {
    const existing = await this.prisma.department.findFirst({
      where: { id: dto.departmentId, tenantId: dto.tenantId },
    });
    if (!existing) throw new NotFoundException('Department not found');

    return this.prisma.department.update({
      where: { id: dto.departmentId },
      data: {
        ...(dto.nameAr !== undefined && { nameAr: dto.nameAr }),
        ...(dto.nameEn !== undefined && { nameEn: dto.nameEn }),
        ...(dto.isVisible !== undefined && { isVisible: dto.isVisible }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
  }
}
