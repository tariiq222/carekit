import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { CreateDepartmentDto } from './create-department.dto';

export type CreateDepartmentCommand = CreateDepartmentDto & { tenantId: string };

@Injectable()
export class CreateDepartmentHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(dto: CreateDepartmentCommand) {
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
