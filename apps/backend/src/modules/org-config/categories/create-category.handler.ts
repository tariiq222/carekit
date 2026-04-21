import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { TenantContextService } from '../../../common/tenant';
import { CreateCategoryDto } from './create-category.dto';

export type CreateCategoryCommand = CreateCategoryDto;

@Injectable()
export class CreateCategoryHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
  ) {}

  async execute(dto: CreateCategoryCommand) {
    const organizationId = this.tenant.requireOrganizationId();
    return this.prisma.serviceCategory.create({
      data: {
        organizationId,
        nameAr: dto.nameAr,
        nameEn: dto.nameEn,
        departmentId: dto.departmentId ?? null,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }
}
