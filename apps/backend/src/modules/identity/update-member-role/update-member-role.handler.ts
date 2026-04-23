import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { TenantContextService } from '../../../common/tenant';
import { MembershipRole } from '@prisma/client';

export interface UpdateMemberRoleDto {
  membershipId: string;
  role: MembershipRole;
}

@Injectable()
export class UpdateMemberRoleHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
  ) {}

  async execute(dto: UpdateMemberRoleDto): Promise<void> {
    const organizationId = this.tenant.requireOrganizationId();

    const membership = await this.prisma.membership.findFirst({
      where: { id: dto.membershipId, organizationId },
    });

    if (!membership) {
      throw new BadRequestException('MEMBERSHIP_NOT_FOUND');
    }

    const ownerCount = await this.prisma.membership.count({
      where: { organizationId, role: 'OWNER', isActive: true },
    });

    if (membership.role === 'OWNER' && dto.role !== 'OWNER' && ownerCount <= 1) {
      throw new BadRequestException('CANNOT_CHANGE_SOLE_OWNER');
    }

    await this.prisma.membership.update({
      where: { id: dto.membershipId },
      data: { role: dto.role },
    });
  }
}