import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { TenantContextService } from '../../../common/tenant';

export interface RevokeInvitationDto {
  invitationId: string;
}

@Injectable()
export class RevokeInvitationHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
  ) {}

  async execute(dto: RevokeInvitationDto): Promise<void> {
    const organizationId = this.tenant.requireOrganizationId();

    const invitation = await this.prisma.invitation.findFirst({
      where: { id: dto.invitationId, organizationId },
    });

    if (!invitation) {
      throw new BadRequestException('INVITATION_NOT_FOUND');
    }

    if (invitation.status === 'ACCEPTED') {
      throw new BadRequestException('CANNOT_REVOKE_ACCEPTED_INVITATION');
    }

    if (invitation.status === 'REVOKED') {
      return;
    }

    await this.prisma.invitation.update({
      where: { id: dto.invitationId },
      data: { status: 'REVOKED', revokedAt: new Date() },
    });
  }
}