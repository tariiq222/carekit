import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';

type UpsertSeedDepartmentCmd = {
  verticalId: string;
  nameAr: string;
  nameEn: string;
  sortOrder?: number;
  id?: string;
};

@Injectable()
export class UpsertSeedDepartmentHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(cmd: UpsertSeedDepartmentCmd) {
    const vertical = await this.prisma.vertical.findUnique({ where: { id: cmd.verticalId } });
    if (!vertical) {
      throw new NotFoundException(`Vertical '${cmd.verticalId}' not found`);
    }

    if (cmd.id) {
      try {
        return await this.prisma.verticalSeedDepartment.update({
          where: { id: cmd.id },
          data: {
            nameAr: cmd.nameAr,
            nameEn: cmd.nameEn,
            sortOrder: cmd.sortOrder ?? 0,
          },
        });
      } catch (err: unknown) {
        const code = (err as { code?: string }).code;
        if (code === 'P2025') {
          throw new NotFoundException(`SeedDepartment '${cmd.id}' not found`);
        }
        throw err;
      }
    }

    return this.prisma.verticalSeedDepartment.create({
      data: {
        verticalId: cmd.verticalId,
        nameAr: cmd.nameAr,
        nameEn: cmd.nameEn,
        sortOrder: cmd.sortOrder ?? 0,
      },
    });
  }
}
