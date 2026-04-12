import { Injectable, NotFoundException } from '@nestjs/common';
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
      },
    });
  }
}
