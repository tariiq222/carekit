import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { TenantContextService } from '../../../common/tenant';
import { detectChannel, normalizeIdentifier } from '../shared/identifier-detector';
import type { AttachMembershipDto } from './attach-membership.dto';

@Injectable()
export class AttachMembershipHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
  ) {}

  async execute(cmd: AttachMembershipDto) {
    const organizationId = this.tenant.requireOrganizationIdOrDefault();
    const channel = detectChannel(cmd.identifier);
    const identifier = normalizeIdentifier(cmd.identifier, channel);

    const where = channel === 'EMAIL'
      ? { email: identifier }
      : { phone: identifier };

    const user = await this.prisma.user.findFirst({ where });
    if (!user) {
      throw new NotFoundException('USER_NOT_REGISTERED');
    }

    const existing = await this.prisma.membership.findFirst({
      where: {
        userId: user.id,
        organizationId,
        isActive: true,
      },
    });
    if (existing) {
      throw new ConflictException('MEMBERSHIP_EXISTS');
    }

    return this.prisma.membership.create({
      data: {
        userId: user.id,
        organizationId,
        role: cmd.role as never,
        branchId: cmd.branchId,
        isActive: true,
      },
    });
  }
}