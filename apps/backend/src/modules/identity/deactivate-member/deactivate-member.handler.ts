import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { TenantContextService } from '../../../common/tenant';

export interface DeactivateMemberDto {
  membershipId: string;
}

@Injectable()
export class DeactivateMemberHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
  ) {}

  async execute(dto: DeactivateMemberDto): Promise<void> {
    const organizationId = this.tenant.requireOrganizationId();
    const currentUserId = this.tenant.get()?.id;
    if (!currentUserId) throw new UnauthorizedException();

    const membership = await this.prisma.membership.findFirst({
      where: { id: dto.membershipId, organizationId },
    });

    if (!membership) {
      throw new BadRequestException('MEMBERSHIP_NOT_FOUND');
    }

    if (membership.userId === currentUserId) {
      throw new BadRequestException('CANNOT_DEACTIVATE_SELF');
    }

    const ownerCount = await this.prisma.membership.count({
      where: { organizationId, role: 'OWNER', isActive: true },
    });

    if (membership.role === 'OWNER' && membership.isActive && ownerCount <= 1) {
      throw new BadRequestException('CANNOT_DEACTIVATE_SOLE_OWNER');
    }

    await this.prisma.membership.update({
      where: { id: dto.membershipId },
      data: { isActive: false },
    });
  }
}