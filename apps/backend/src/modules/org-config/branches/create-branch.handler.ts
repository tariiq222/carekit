import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { CreateBranchDto } from './create-branch.dto';

export type CreateBranchCommand = CreateBranchDto;

@Injectable()
export class CreateBranchHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(dto: CreateBranchCommand) {
    return this.prisma.$transaction(
      async (tx) => {
        const existing = await tx.branch.findFirst({
          where: { nameAr: dto.nameAr },
        });
        if (existing) throw new ConflictException('Branch with this Arabic name already exists');

        if (dto.isMain === true) {
          await tx.branch.updateMany({
            where: { isMain: true },
            data: { isMain: false },
          });
        }

        return tx.branch.create({
          data: {
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
      },
      { isolationLevel: 'Serializable' },
    );
  }
}
