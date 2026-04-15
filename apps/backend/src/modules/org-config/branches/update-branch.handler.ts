import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { UpdateBranchDto } from './update-branch.dto';

export type UpdateBranchCommand = UpdateBranchDto & { tenantId: string; branchId: string };

@Injectable()
export class UpdateBranchHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(dto: UpdateBranchCommand) {
    const branch = await this.prisma.branch.findFirst({
      where: { id: dto.branchId, tenantId: dto.tenantId },
    });
    if (!branch) throw new NotFoundException('Branch not found');

    if (dto.isMain === true && !branch.isMain) {
      const currentMain = await this.prisma.branch.findFirst({
        where: { tenantId: dto.tenantId, isMain: true, NOT: { id: dto.branchId } },
        select: { id: true, nameAr: true },
      });
      if (currentMain) {
        throw new ConflictException(
          `Another branch is already primary (${currentMain.nameAr}). Unset it first.`,
        );
      }
    }

    return this.prisma.branch.update({
      where: { id: dto.branchId },
      data: {
        nameAr: dto.nameAr,
        nameEn: dto.nameEn,
        phone: dto.phone,
        addressAr: dto.addressAr,
        addressEn: dto.addressEn,
        city: dto.city,
        country: dto.country,
        latitude: dto.latitude,
        longitude: dto.longitude,
        isActive: dto.isActive,
        isMain: dto.isMain,
        timezone: dto.timezone,
      },
    });
  }
}
