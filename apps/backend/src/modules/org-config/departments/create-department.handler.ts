import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { CreateDepartmentDto } from './create-department.dto';

export type CreateDepartmentCommand = CreateDepartmentDto & { tenantId: string };

@Injectable()
export class CreateDepartmentHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(dto: CreateDepartmentCommand) {
    const existing = await this.prisma.department.findFirst({
      where: { tenantId: dto.tenantId, nameAr: dto.nameAr },
    });
    if (existing) throw new ConflictException('Department with this Arabic name already exists');

    return this.prisma.department.create({
      data: {
        tenantId: dto.tenantId,
        nameAr: dto.nameAr,
        nameEn: dto.nameEn,
        descriptionAr: dto.descriptionAr,
        descriptionEn: dto.descriptionEn,
        icon: dto.icon,
        isActive: dto.isActive ?? true,
        isVisible: dto.isVisible ?? true,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }
}
