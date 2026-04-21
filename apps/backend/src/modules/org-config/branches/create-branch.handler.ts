import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { TenantContextService } from '../../../common/tenant';
import { CreateBranchDto } from './create-branch.dto';

export type CreateBranchCommand = CreateBranchDto;

@Injectable()
export class CreateBranchHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
  ) {}

  async execute(dto: CreateBranchCommand) {
    const organizationId = this.tenant.requireOrganizationId();
    return this.prisma.$transaction(
      async (tx) => {
        const existing = await tx.branch.findFirst({
          where: { nameAr: dto.nameAr, organizationId },
        });
        if (existing) throw new ConflictException('Branch with this Arabic name already exists');

        if (dto.isMain === true) {
          await tx.branch.updateMany({
            where: { isMain: true, organizationId },
            data: { isMain: false },
          });
        }

        return tx.branch.create({
          data: {
            organizationId,
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
