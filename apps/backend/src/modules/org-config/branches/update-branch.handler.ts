import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { TenantContextService } from '../../../common/tenant';
import { UpdateBranchDto } from './update-branch.dto';

export type UpdateBranchCommand = UpdateBranchDto & { branchId: string };

@Injectable()
export class UpdateBranchHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
  ) {}

  async execute(dto: UpdateBranchCommand) {
    const organizationId = this.tenant.requireOrganizationId();
    return this.prisma.$transaction(
      async (tx) => {
        const branch = await tx.branch.findFirst({
          where: { id: dto.branchId, organizationId },
        });
        if (!branch) throw new NotFoundException('Branch not found');

        if (dto.isMain === true && !branch.isMain) {
          await tx.branch.updateMany({
            where: { isMain: true, organizationId, NOT: { id: dto.branchId } },
            data: { isMain: false },
          });
        }

        return tx.branch.update({
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
      },
      { isolationLevel: 'Serializable' },
    );
  }
}
