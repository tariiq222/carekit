import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';
import { CreateDepartmentDto } from './create-department.dto';

export type CreateDepartmentCommand = CreateDepartmentDto & { tenantId: string };

@Injectable()
export class CreateDepartmentHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(dto: CreateDepartmentCommand) {
    try {
      return await this.prisma.department.create({
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
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('Department with this Arabic name already exists');
      }
      throw err;
    }
  }
}
