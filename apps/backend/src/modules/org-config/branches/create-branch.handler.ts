import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { CreateBranchDto } from './create-branch.dto';

export type CreateBranchCommand = CreateBranchDto & { tenantId: string };

@Injectable()
export class CreateBranchHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(dto: CreateBranchCommand) {
    const existing = await this.prisma.branch.findFirst({
      where: { tenantId: dto.tenantId, nameAr: dto.nameAr },
    });
    if (existing) throw new ConflictException('Branch with this Arabic name already exists');

    if (dto.isMain === true) {
      const currentMain = await this.prisma.branch.findFirst({
        where: { tenantId: dto.tenantId, isMain: true },
        select: { id: true, nameAr: true },
      });
      if (currentMain) {
        throw new ConflictException(
          `Another branch is already primary (${currentMain.nameAr}). Unset it first.`,
        );
      }
    }

    return this.prisma.branch.create({
      data: {
        tenantId: dto.tenantId,
        nameAr: dto.nameAr,
        nameEn: dto.nameEn,
        phone: dto.phone,
        addressAr: dto.addressAr,
        addressEn: dto.addressEn,
        city: dto.city,
        country: dto.country ?? 'SA',
        latitude: dto.latitude,
        longitude: dto.longitude,
        isActive: dto.isActive,
        isMain: dto.isMain,
        timezone: dto.timezone,
      },
    });
  }
}
