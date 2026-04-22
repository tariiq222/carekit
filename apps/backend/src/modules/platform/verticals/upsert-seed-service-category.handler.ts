import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';

type UpsertSeedServiceCategoryCmd = {
  verticalId: string;
  nameAr: string;
  nameEn: string;
  departmentId?: string;
  sortOrder?: number;
  id?: string;
};

@Injectable()
export class UpsertSeedServiceCategoryHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(cmd: UpsertSeedServiceCategoryCmd) {
    const vertical = await this.prisma.vertical.findUnique({ where: { id: cmd.verticalId } });
    if (!vertical) {
      throw new NotFoundException(`Vertical '${cmd.verticalId}' not found`);
    }

    if (cmd.id) {
      try {
        return await this.prisma.verticalSeedServiceCategory.update({
          where: { id: cmd.id },
          data: {
            nameAr: cmd.nameAr,
            nameEn: cmd.nameEn,
            sortOrder: cmd.sortOrder ?? 0,
            ...(cmd.departmentId !== undefined ? { departmentId: cmd.departmentId } : {}),
          },
        });
      } catch (err: unknown) {
        const code = (err as { code?: string }).code;
        if (code === 'P2025') {
          throw new NotFoundException(`SeedServiceCategory '${cmd.id}' not found`);
        }
        throw err;
      }
    }

    return this.prisma.verticalSeedServiceCategory.create({
      data: {
        verticalId: cmd.verticalId,
        nameAr: cmd.nameAr,
        nameEn: cmd.nameEn,
        sortOrder: cmd.sortOrder ?? 0,
        ...(cmd.departmentId !== undefined ? { departmentId: cmd.departmentId } : {}),
      },
    });
  }
}
